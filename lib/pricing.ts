/**
 * Site-wide sale mode: when salesActive and sale_price is valid, effective = sale_price
 * and originalDisplay shows the regular price for strikethrough.
 */

export function isValidSalePrice(n: number | null | undefined): boolean {
  return n != null && Number(n) > 0;
}

export type ResolvedPrice = {
  effective: number;
  /** For UI strikethrough / "was" price; null if none */
  originalDisplay: number | null;
};

export function resolveProductPrice(args: {
  salesActive: boolean;
  price: number;
  salePrice?: number | null;
  compareAtPrice?: number | null;
}): ResolvedPrice {
  const { salesActive, price, salePrice, compareAtPrice } = args;
  const base = Number(price) || 0;

  if (salesActive && isValidSalePrice(salePrice)) {
    return {
      effective: Number(salePrice),
      originalDisplay: base > Number(salePrice) ? base : null,
    };
  }

  const compare = compareAtPrice != null ? Number(compareAtPrice) : null;
  const orig =
    compare != null && !Number.isNaN(compare) && compare > base ? compare : null;
  return { effective: base, originalDisplay: orig };
}

export function resolveVariantPrice(args: {
  salesActive: boolean;
  productPrice: number;
  productSalePrice?: number | null;
  variantPrice: number;
  variantSalePrice?: number | null;
  compareAtPrice?: number | null;
}): ResolvedPrice {
  const {
    salesActive,
    productPrice,
    productSalePrice,
    variantPrice,
    variantSalePrice,
    compareAtPrice,
  } = args;

  const vPrice = Number(variantPrice) || Number(productPrice) || 0;

  if (salesActive) {
    const vSale = isValidSalePrice(variantSalePrice)
      ? Number(variantSalePrice)
      : null;
    const pSale = isValidSalePrice(productSalePrice)
      ? Number(productSalePrice)
      : null;
    const chosenSale = vSale ?? pSale;

    if (chosenSale != null) {
      const regular = vPrice;
      return {
        effective: chosenSale,
        originalDisplay: regular > chosenSale ? regular : null,
      };
    }
  }

  const compare = compareAtPrice != null ? Number(compareAtPrice) : null;
  const orig =
    compare != null && !Number.isNaN(compare) && compare > vPrice
      ? compare
      : null;
  return { effective: vPrice, originalDisplay: orig };
}

export type StorePricing = {
  /** Merchant toggle, ignoring the schedule window. */
  enabled: boolean;
  /** Effective storefront flag (toggle + optional start/end dates). */
  sales_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  headline: string;
};

/** Parse store_pricing JSON from site_settings.value */
export function parseStorePricingValue(value: unknown): StorePricing {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const enabled = Boolean(raw.sales_active);
  const starts_at = typeof raw.starts_at === 'string' && raw.starts_at ? raw.starts_at : null;
  const ends_at = typeof raw.ends_at === 'string' && raw.ends_at ? raw.ends_at : null;
  const headline = typeof raw.headline === 'string' ? raw.headline : '';
  const now = Date.now();
  let inWindow = true;
  if (starts_at && new Date(starts_at).getTime() > now) inWindow = false;
  if (ends_at && new Date(ends_at).getTime() < now) inWindow = false;
  return {
    enabled,
    sales_active: enabled && inWindow,
    starts_at,
    ends_at,
    headline,
  };
}

/** Map DB product + variants to ProductCard price props */
export function getProductCardPricing(
  p: {
    price: number;
    sale_price?: number | null;
    compare_at_price?: number | null;
    product_variants?: Array<{
      price?: number | null;
      sale_price?: number | null;
    }>;
  },
  salesActive: boolean
): {
  price: number;
  minVariantPrice?: number;
  originalPrice?: number;
  saleBadge: boolean;
} {
  const variants = p.product_variants || [];
  const hasVariants = variants.length > 0;

  if (!hasVariants) {
    const r = resolveProductPrice({
      salesActive,
      price: p.price,
      salePrice: p.sale_price,
      compareAtPrice: p.compare_at_price,
    });
    const orig = r.originalDisplay ?? undefined;
    return {
      price: r.effective,
      originalPrice: orig,
      saleBadge: orig != null && orig > r.effective,
    };
  }

  const resolvedList = variants.map((v) =>
    resolveVariantPrice({
      salesActive,
      productPrice: p.price,
      productSalePrice: p.sale_price,
      variantPrice: Number(v.price ?? p.price),
      variantSalePrice: v.sale_price,
      compareAtPrice: p.compare_at_price,
    })
  );
  const minEff = Math.min(...resolvedList.map((r) => r.effective));
  const firstMin = resolvedList.find((r) => r.effective === minEff)!;
  let orig = firstMin.originalDisplay;
  if (
    orig == null &&
    p.compare_at_price != null &&
    Number(p.compare_at_price) > minEff
  ) {
    orig = Number(p.compare_at_price);
  }
  return {
    price: p.price,
    minVariantPrice: minEff,
    originalPrice: orig != null && orig > minEff ? orig : undefined,
    saleBadge: orig != null && orig > minEff,
  };
}

/**
 * Find the variant a cart label points at. Labels are "Name" or "Option2 / Name"
 * (for example "Red / M"), matching how the product page builds them.
 */
export function findCartVariant<
  V extends { name?: string | null; option2?: string | null },
>(variants: V[], variantLabel: string | undefined | null): V | undefined {
  if (!variantLabel?.trim() || variants.length === 0) return undefined;
  const parts = variantLabel
    .split(' / ')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return variants.find(
      (x) => (x.option2 || '').trim() === parts[0] && (x.name || '').trim() === parts[1]
    );
  }
  return variants.find(
    (x) => (x.name || '').trim() === parts[0] || (x.option2 || '').trim() === parts[0]
  );
}

/** Resolve authoritative unit price at checkout/POS from DB row + cart variant label */
export function resolveCartLineUnitPrice(
  product: {
    price: number;
    sale_price?: number | null;
    compare_at_price?: number | null;
    product_variants?: Array<{
      name?: string | null;
      option1?: string | null;
      option2?: string | null;
      price?: number | null;
      sale_price?: number | null;
    }>;
  },
  variantLabel: string | undefined | null,
  salesActive: boolean
): number {
  const v = findCartVariant(product.product_variants || [], variantLabel);
  if (!v) {
    return resolveProductPrice({
      salesActive,
      price: product.price,
      salePrice: product.sale_price,
      compareAtPrice: product.compare_at_price,
    }).effective;
  }
  return resolveVariantPrice({
    salesActive,
    productPrice: product.price,
    productSalePrice: product.sale_price,
    variantPrice: Number(v.price ?? product.price),
    variantSalePrice: v.sale_price,
    compareAtPrice: product.compare_at_price,
  }).effective;
}

type PricedVariant = {
  price?: number | string | null;
  sale_price?: number | string | null;
  compare_at_price?: number | string | null;
};

type PricedProduct = {
  price: number | string;
  sale_price?: number | string | null;
  compare_at_price?: number | string | null;
  product_variants?: unknown;
};

/**
 * Rewrites a product for the storefront so `price` is what checkout will
 * charge and `compare_at_price` is the "was" price. Sale mode is applied on
 * the server (the same rules as resolveCartLineUnitPrice), so every page shows
 * the charged amount without knowing whether a sale is on. `sale_price` is
 * cleared so no page applies it a second time.
 */
export function applyStorefrontPricing<T extends PricedProduct>(product: T, salesActive: boolean): T {
  const productPrice = Number(product.price) || 0;
  const productSale = product.sale_price != null ? Number(product.sale_price) : null;
  const compare = product.compare_at_price != null ? Number(product.compare_at_price) : null;

  const r = resolveProductPrice({
    salesActive,
    price: productPrice,
    salePrice: productSale,
    compareAtPrice: compare,
  });

  const variants = Array.isArray(product.product_variants)
    ? (product.product_variants as PricedVariant[]).map((v) => {
        const rv = resolveVariantPrice({
          salesActive,
          productPrice,
          productSalePrice: productSale,
          variantPrice: Number(v.price ?? productPrice),
          variantSalePrice: v.sale_price != null ? Number(v.sale_price) : null,
          compareAtPrice: compare,
        });
        return { ...v, price: rv.effective, compare_at_price: rv.originalDisplay, sale_price: null };
      })
    : product.product_variants;

  return {
    ...product,
    price: r.effective,
    compare_at_price: r.originalDisplay,
    sale_price: null,
    product_variants: variants,
  };
}
