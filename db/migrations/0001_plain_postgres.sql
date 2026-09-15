-- ============================================================================
-- Upscale Vintage — plain PostgreSQL schema
--
-- Replaces the Supabase schema. Differences from the Supabase original:
--   * auth.users            -> public.users, owned by this application
--   * Supabase Auth session -> public.sessions (revocable, server-issued)
--   * Row Level Security    -> removed; authorization lives in lib/repositories
--   * storage.buckets       -> removed; uploads live on disk, see lib/uploads.ts
--   * uuid_generate_v4()    -> gen_random_uuid(), built in since PostgreSQL 13
--   * auth.uid()/auth.role()-> removed, no database session context exists
--
-- Requires PostgreSQL 13 or newer.
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
-- Backs the trigram index used by storefront ILIKE search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================
CREATE TYPE user_role       AS ENUM ('admin', 'staff', 'customer');
CREATE TYPE gender_type     AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE address_type    AS ENUM ('shipping', 'billing', 'both');
CREATE TYPE product_status  AS ENUM ('active', 'draft', 'archived');
CREATE TYPE category_status AS ENUM ('active', 'inactive');
CREATE TYPE order_status    AS ENUM ('pending', 'awaiting_payment', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_status  AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
CREATE TYPE discount_type   AS ENUM ('percentage', 'fixed_amount', 'free_shipping');
CREATE TYPE review_status   AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE blog_status     AS ENUM ('draft', 'published', 'archived');
CREATE TYPE ticket_status   AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE return_status   AS ENUM ('pending', 'approved', 'rejected', 'processing', 'completed');
CREATE TYPE sms_status      AS ENUM ('queued', 'sent', 'delivered', 'failed');

-- ============================================================================
-- 2. SHARED TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. IDENTITY — replaces Supabase Auth
-- ============================================================================

-- Credentials and account state. Previously auth.users, managed by Supabase.
CREATE TABLE public.users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL,
  password_hash      text NOT NULL,
  email_verified_at  timestamptz,
  phone              text,
  phone_verified_at  timestamptz,
  -- Lets an admin disable an account without deleting order history.
  disabled_at        timestamptz,
  last_login_at      timestamptz,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Email is compared case-insensitively; the application lowercases on write and
-- this index makes that guarantee enforceable rather than conventional.
CREATE UNIQUE INDEX idx_users_email_lower ON public.users (lower(email));

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Server-issued sessions. Supabase issued stateless JWTs that could not be
-- revoked before expiry; storing them makes logout and lockout immediate.
CREATE TABLE public.sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- SHA-256 of the cookie value. The raw token is never stored, so a database
  -- leak cannot be replayed as a valid session.
  token_hash    text NOT NULL UNIQUE,
  user_agent    text,
  ip_address    text,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user    ON public.sessions (user_id);
CREATE INDEX idx_sessions_expires ON public.sessions (expires_at) WHERE revoked_at IS NULL;

-- Single-use tokens for password reset and email/phone verification.
CREATE TABLE public.auth_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('password_reset', 'email_verification', 'phone_verification')),
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_tokens_user ON public.auth_tokens (user_id, purpose);

-- ============================================================================
-- 4. PROFILES AND ADDRESSES
-- ============================================================================

CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email         text UNIQUE,
  role          user_role NOT NULL DEFAULT 'customer',
  full_name     text,
  phone         text,
  avatar_url    text,
  date_of_birth date,
  gender        gender_type,
  preferences   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON public.profiles (email);
CREATE INDEX idx_profiles_role  ON public.profiles (role);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Mirrors the Supabase on_auth_user_created trigger so a profile always exists
-- for every user row, regardless of which code path created the account.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.addresses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.users(id) ON DELETE CASCADE,
  type          address_type NOT NULL DEFAULT 'shipping',
  is_default    boolean NOT NULL DEFAULT false,
  label         text,
  full_name     text NOT NULL,
  phone         text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city          text NOT NULL,
  state         text NOT NULL,
  postal_code   text NOT NULL,
  country       text NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_user_id ON public.addresses (user_id);

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. CATALOG
-- ============================================================================

CREATE TABLE public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  parent_id   uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url   text,
  position    integer NOT NULL DEFAULT 0,
  status      category_status NOT NULL DEFAULT 'active',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_parent ON public.categories (parent_id);
CREATE INDEX idx_categories_slug   ON public.categories (slug);

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.products (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  description       text,
  short_description text,
  -- numeric(12,2): the Supabase schema used unconstrained numeric, which let
  -- floating point rounding reach the database on prices and totals.
  price             numeric(12,2) NOT NULL CHECK (price >= 0),
  compare_at_price  numeric(12,2) CHECK (compare_at_price >= 0),
  cost_per_item     numeric(12,2) CHECK (cost_per_item >= 0),
  sku               text UNIQUE,
  barcode           text,
  quantity          integer NOT NULL DEFAULT 0,
  track_quantity    boolean NOT NULL DEFAULT true,
  continue_selling  boolean NOT NULL DEFAULT false,
  weight            numeric(10,3),
  weight_unit       text NOT NULL DEFAULT 'kg',
  category_id       uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  brand             text,
  vendor            text,
  tags              text[],
  status            product_status NOT NULL DEFAULT 'active',
  featured          boolean NOT NULL DEFAULT false,
  options           jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_id       text,
  external_source   text,
  seo_title         text,
  seo_description   text,
  rating_avg        numeric(3,2) NOT NULL DEFAULT 0,
  review_count      integer NOT NULL DEFAULT 0,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  moq               integer NOT NULL DEFAULT 1 CHECK (moq >= 1),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.products.moq IS 'Minimum order quantity a customer must buy';

CREATE INDEX idx_products_category ON public.products (category_id);
CREATE INDEX idx_products_featured ON public.products (featured);
CREATE INDEX idx_products_slug     ON public.products (slug);
CREATE INDEX idx_products_status   ON public.products (status);
CREATE INDEX idx_products_tags     ON public.products USING gin (tags);
-- The shop grid filters on status and sorts by newest; a composite index keeps
-- that off a sequential scan as the catalog grows.
CREATE INDEX idx_products_status_created ON public.products (status, created_at DESC);
-- Backs the storefront search, which uses ILIKE and cannot use a btree index.
CREATE INDEX idx_products_name_trgm ON public.products USING gin (name gin_trgm_ops);

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.product_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url        text NOT NULL,
  alt_text   text,
  position   integer NOT NULL DEFAULT 0,
  width      integer,
  height     integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Product pages always load images by product ordered by position.
CREATE INDEX idx_product_images_product ON public.product_images (product_id, position);

CREATE TABLE public.product_variants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name             text NOT NULL,
  sku              text UNIQUE,
  price            numeric(12,2) NOT NULL CHECK (price >= 0),
  compare_at_price numeric(12,2),
  cost_per_item    numeric(12,2),
  quantity         integer NOT NULL DEFAULT 0,
  weight           numeric(10,3),
  option1          text,
  option2          text,
  option3          text,
  image_url        text,
  barcode          text,
  external_id      text,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_variants_product ON public.product_variants (product_id);

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. COUPONS
-- ============================================================================

CREATE TABLE public.coupons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  description      text,
  type             discount_type NOT NULL,
  value            numeric(12,2) NOT NULL CHECK (value >= 0),
  minimum_purchase numeric(12,2) NOT NULL DEFAULT 0,
  maximum_discount numeric(12,2),
  usage_limit      integer,
  usage_count      integer NOT NULL DEFAULT 0,
  per_user_limit   integer NOT NULL DEFAULT 1,
  start_date       timestamptz,
  end_date         timestamptz,
  is_active        boolean NOT NULL DEFAULT true,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_coupons_code_upper ON public.coupons (upper(code));

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. ORDERS
-- ============================================================================

CREATE TABLE public.orders (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number           text NOT NULL UNIQUE,
  user_id                uuid REFERENCES public.users(id) ON DELETE SET NULL,
  email                  text NOT NULL,
  phone                  text,
  status                 order_status NOT NULL DEFAULT 'pending',
  payment_status         payment_status NOT NULL DEFAULT 'pending',
  currency               text NOT NULL DEFAULT 'GHS',
  subtotal               numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  tax_total              numeric(12,2) NOT NULL DEFAULT 0,
  shipping_total         numeric(12,2) NOT NULL DEFAULT 0,
  discount_total         numeric(12,2) NOT NULL DEFAULT 0,
  total                  numeric(12,2) NOT NULL CHECK (total >= 0),
  shipping_method        text,
  payment_method         text,
  payment_provider       text,
  payment_transaction_id text,
  notes                  text,
  cancel_reason          text,
  shipping_address       jsonb NOT NULL,
  billing_address        jsonb NOT NULL,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_order_number ON public.orders (order_number);
CREATE INDEX idx_orders_status       ON public.orders (status);
CREATE INDEX idx_orders_user         ON public.orders (user_id);
CREATE INDEX idx_orders_created      ON public.orders (created_at DESC);
-- Order tracking looks a guest order up by number plus contact detail.
CREATE INDEX idx_orders_email_lower  ON public.orders (lower(email));

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- Nullable so deleting a product does not destroy order history; the name and
  -- price below are denormalised snapshots taken at purchase time.
  product_id   uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id   uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  variant_name text,
  sku          text,
  quantity     integer NOT NULL CHECK (quantity > 0),
  unit_price   numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price  numeric(12,2) NOT NULL CHECK (total_price >= 0),
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order   ON public.order_items (order_id);
CREATE INDEX idx_order_items_product ON public.order_items (product_id);

CREATE TABLE public.order_status_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status     order_status NOT NULL,
  notes      text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_status_history_order ON public.order_status_history (order_id, created_at DESC);

-- ============================================================================
-- 8. CART AND WISHLIST
-- ============================================================================

CREATE TABLE public.cart_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity   integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- NULLS NOT DISTINCT so a product with no variant cannot be added twice; the
-- Supabase UNIQUE(user_id, product_id, variant_id) allowed exactly that.
CREATE UNIQUE INDEX idx_cart_items_unique
  ON public.cart_items (user_id, product_id, variant_id) NULLS NOT DISTINCT;

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.wishlist_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- ============================================================================
-- 9. REVIEWS
-- ============================================================================

CREATE TABLE public.reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  rating            integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title             text,
  content           text,
  status            review_status NOT NULL DEFAULT 'pending',
  verified_purchase boolean NOT NULL DEFAULT false,
  helpful_votes     integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_product ON public.reviews (product_id);
CREATE INDEX idx_reviews_status  ON public.reviews (status);
-- One review per customer per product, matching the UI's assumption.
CREATE UNIQUE INDEX idx_reviews_user_product ON public.reviews (user_id, product_id)
  WHERE user_id IS NOT NULL;

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.review_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id  uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  url        text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_images_review ON public.review_images (review_id);

CREATE OR REPLACE FUNCTION public.update_product_rating_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE products
  SET rating_avg = (
        SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)
        FROM reviews
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
          AND status = 'approved'
      ),
      review_count = (
        SELECT COUNT(*)
        FROM reviews
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
          AND status = 'approved'
      ),
      updated_at = now()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tr_update_product_rating
  AFTER INSERT OR DELETE OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_rating_stats();

-- ============================================================================
-- 10. CONTENT
-- ============================================================================

CREATE TABLE public.blog_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  slug            text NOT NULL UNIQUE,
  excerpt         text,
  content         text NOT NULL,
  featured_image  text,
  author_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status          blog_status NOT NULL DEFAULT 'draft',
  published_at    timestamptz,
  seo_title       text,
  seo_description text,
  tags            text[],
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blog_slug      ON public.blog_posts (slug);
CREATE INDEX idx_blog_status    ON public.blog_posts (status);
CREATE INDEX idx_blog_published ON public.blog_posts (status, published_at DESC);

CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  slug            text NOT NULL UNIQUE,
  content         text,
  status          text NOT NULL DEFAULT 'draft',
  seo_title       text,
  seo_description text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.site_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL UNIQUE,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  category   text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.store_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.cms_content (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section     text NOT NULL,
  block_key   text NOT NULL,
  title       text,
  subtitle    text,
  content     text,
  image_url   text,
  button_text text,
  button_url  text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section, block_key)
);

CREATE TRIGGER update_cms_content_updated_at BEFORE UPDATE ON public.cms_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.banners (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  type             text NOT NULL DEFAULT 'promotional',
  title            text,
  subtitle         text,
  image_url        text,
  background_color text NOT NULL DEFAULT '#1A3654',
  text_color       text NOT NULL DEFAULT '#FFFFFF',
  button_text      text,
  button_url       text,
  start_date       timestamptz,
  end_date         timestamptz,
  is_active        boolean NOT NULL DEFAULT true,
  position         text NOT NULL DEFAULT 'top',
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.navigation_menus (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.navigation_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id     uuid NOT NULL REFERENCES public.navigation_menus(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES public.navigation_items(id) ON DELETE CASCADE,
  label       text NOT NULL,
  url         text NOT NULL,
  icon        text,
  is_external boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_navigation_items_menu ON public.navigation_items (menu_id, sort_order);

CREATE TABLE public.store_modules (
  id         text PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. STORE BRANCHES
-- ============================================================================

CREATE TABLE public.store_branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  address     text NOT NULL,
  city        text,
  region      text,
  phone       text,
  whatsapp    text,
  hours       text,
  map_url     text,
  image_url   text,
  latitude    numeric(9,6),
  longitude   numeric(9,6),
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_branches_active ON public.store_branches (is_active, sort_order);

CREATE TRIGGER update_store_branches_updated_at BEFORE UPDATE ON public.store_branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 12. SUPPORT AND RETURNS
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS support_tickets_ticket_number_seq;

CREATE TABLE public.support_tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number integer NOT NULL DEFAULT nextval('support_tickets_ticket_number_seq'),
  user_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  email         text NOT NULL,
  subject       text NOT NULL,
  description   text,
  category      text,
  status        ticket_status NOT NULL DEFAULT 'open',
  priority      ticket_priority NOT NULL DEFAULT 'medium',
  assigned_to   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_status ON public.support_tickets (status);
CREATE INDEX idx_tickets_user   ON public.support_tickets (user_id);

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.support_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  message     text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_internal boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_ticket ON public.support_messages (ticket_id, created_at);

CREATE TABLE public.return_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status        return_status NOT NULL DEFAULT 'pending',
  reason        text NOT NULL,
  description   text,
  refund_amount numeric(12,2),
  refund_method text,
  admin_notes   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_return_requests_order ON public.return_requests (order_id);
CREATE INDEX idx_return_requests_user  ON public.return_requests (user_id);

CREATE TRIGGER update_return_requests_updated_at BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.return_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id uuid NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  order_item_id     uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  quantity          integer NOT NULL CHECK (quantity > 0),
  reason            text,
  condition         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_return_items_request ON public.return_items (return_request_id);

-- ============================================================================
-- 13. NOTIFICATIONS AND SMS
-- ============================================================================

CREATE TABLE public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  message    text,
  data       jsonb,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user   ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications (user_id) WHERE read_at IS NULL;

-- Every SMS send attempt. Supabase had no equivalent: sends were fire-and-forget
-- with no record, so duplicates were invisible and delivery was untraceable.
CREATE TABLE public.sms_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL DEFAULT 'moolre',
  recipient           text NOT NULL,
  message_type        text NOT NULL,
  body                text NOT NULL,
  -- Caller-supplied key such as 'order_confirmation:<order_id>'. The unique
  -- index below turns a retry, double click or restart into a no-op.
  idempotency_key     text,
  user_id             uuid REFERENCES public.users(id) ON DELETE SET NULL,
  order_id            uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  provider_message_id text,
  status              sms_status NOT NULL DEFAULT 'queued',
  attempts            integer NOT NULL DEFAULT 0,
  failure_reason      text,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_sms_idempotency ON public.sms_messages (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_sms_recipient ON public.sms_messages (recipient, created_at DESC);
CREATE INDEX idx_sms_status    ON public.sms_messages (status) WHERE status IN ('queued', 'failed');

CREATE TRIGGER update_sms_messages_updated_at BEFORE UPDATE ON public.sms_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 14. CUSTOMERS (CRM / POS)
-- ============================================================================

CREATE TABLE public.customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  phone           text,
  full_name       text,
  first_name      text,
  last_name       text,
  user_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  default_address jsonb,
  notes           text,
  tags            text[],
  total_orders    integer NOT NULL DEFAULT 0,
  total_spent     numeric(12,2) NOT NULL DEFAULT 0,
  last_order_at   timestamptz,
  secondary_email text,
  secondary_phone text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_customers_email_lower  ON public.customers (lower(email));
CREATE INDEX idx_customers_user_id             ON public.customers (user_id);
CREATE INDEX idx_customers_phone               ON public.customers (phone);
CREATE INDEX idx_customers_secondary_email     ON public.customers (secondary_email);
CREATE INDEX idx_customers_secondary_phone     ON public.customers (secondary_phone);

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 15. AUDIT LOG
-- ============================================================================

CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  details     jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_action  ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_entity  ON public.audit_logs (entity_type, entity_id);

-- ============================================================================
-- 16. STOCK
-- ============================================================================

-- Called inside the order transaction. GREATEST(...,0) keeps stock from going
-- negative when two orders race for the last unit.
CREATE OR REPLACE FUNCTION public.reduce_stock_on_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE products p
  SET quantity = GREATEST(p.quantity - oi.quantity, 0),
      updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.product_id = p.id
    AND p.track_quantity = true;

  UPDATE product_variants pv
  SET quantity = GREATEST(pv.quantity - oi.quantity, 0),
      updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.variant_id = pv.id;
END;
$$;
