import Link from 'next/link';
import { query } from '@/lib/db';
import { HERO_IMAGE_VERSION, PAGE_HERO_IMAGES } from '@/lib/brand';

export const dynamic = 'force-dynamic';

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string | null;
  tags: string[] | null;
};

function formatDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PostRow({ post, index }: { post: BlogPost; index: number }) {
  const href = `/blog/${post.slug || post.id}`;
  const label = post.tags?.[0] || 'Story';

  return (
    <Link
      href={href}
      className="group grid grid-cols-[auto_1fr] gap-6 border-b border-black/10 py-8 sm:grid-cols-[4rem_1fr_auto] sm:items-end"
    >
      <span className="pt-1 text-sm tabular-nums text-brand-champagne">{String(index + 1).padStart(2, '0')}</span>
      <span>
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-brand-mauve">{label}</span>
        <span className="mt-2 block text-balance text-2xl font-semibold tracking-tight text-brand-espresso transition-colors duration-150 group-hover:text-brand-champagne sm:text-3xl">
          {post.title}
        </span>
        {post.excerpt && (
          <span className="mt-2 block max-w-xl text-pretty text-sm leading-relaxed text-brand-cocoa/70">{post.excerpt}</span>
        )}
      </span>
      <span className="col-start-2 text-sm text-brand-mauve sm:col-start-auto sm:pb-1">{formatDate(post.published_at)}</span>
    </Link>
  );
}

export default async function BlogPage() {
  let posts: BlogPost[] = [];

  try {
    posts = await query<BlogPost>(
      `SELECT id, title, slug, excerpt, featured_image, published_at, tags
         FROM blog_posts
        WHERE status = 'published'::blog_status
        ORDER BY published_at DESC NULLS LAST, created_at DESC`
    );
  } catch (err) {
    console.error('[blog] Failed to load posts:', err);
  }

  const lead = posts[0];

  return (
    <main className="bg-white">
      <section className="relative isolate flex min-h-[68vh] items-end justify-center overflow-hidden bg-black text-white md:min-h-[74vh]">
        <img
          src={`${PAGE_HERO_IMAGES.blog}?v=${HERO_IMAGE_VERSION}`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16 text-center sm:px-6 md:pb-20">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-brand-champagne">The Journal</p>
          <h1 className="mt-4 text-balance text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
            Stories worth keeping
          </h1>
          <div className="mx-auto mt-6 h-px w-16 bg-brand-champagne" />
          <p className="mx-auto mt-6 max-w-md text-pretty text-base leading-relaxed text-white/80">
            Fashion, bags, beauty, and the pieces she chooses to write about.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-20">
        {posts.length > 0 ? (
          <>
            {lead?.featured_image && (
              <Link href={`/blog/${lead.slug || lead.id}`} className="mb-4 block overflow-hidden rounded-[1.5rem]">
                <img src={lead.featured_image} alt="" className="aspect-[16/8] w-full object-cover" />
              </Link>
            )}
            <div>
              {posts.map((post, index) => (
                <PostRow key={post.id} post={post} index={index} />
              ))}
            </div>
          </>
        ) : (
          <div className="border-y border-black/10 py-16 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-champagne">Issue 01</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-brand-espresso sm:text-4xl">
              The first story is not here yet
            </h2>
            <p className="mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-brand-cocoa/70">
              When a piece is ready, it will be listed here. The shop is open in the meantime.
            </p>
            <Link
              href="/shop"
              className="mt-8 inline-flex h-12 items-center rounded-full bg-black px-7 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-champagne hover:text-black"
            >
              Shop the edit
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
