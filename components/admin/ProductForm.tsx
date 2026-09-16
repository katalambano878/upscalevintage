'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiData, apiPatch } from '@/lib/client/api';
import { useRouter } from 'next/navigation';
import { buildProductSeo, slugifyProduct } from '@/lib/product-seo';
import { buildVariantSku, colorHexForName } from '@/lib/variant-presets';
import ProductVariantsEditor, { type VariantRow, variantKey } from '@/components/admin/ProductVariantsEditor';
import ProductSeoEditor from '@/components/admin/ProductSeoEditor';

interface ProductFormProps {
    initialData?: any;
    isEditMode?: boolean;
}

export default function ProductForm({ initialData, isEditMode = false }: ProductFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);

    const [productName, setProductName] = useState(initialData?.name || '');
    const [categoryId, setCategoryId] = useState(initialData?.category_id || '');
    const [price, setPrice] = useState(initialData?.price || '');
    const [salePrice, setSalePrice] = useState(
        initialData?.sale_price != null && initialData?.sale_price !== ''
            ? String(initialData.sale_price)
            : ''
    );
    const [comparePrice, setComparePrice] = useState(initialData?.compare_at_price || '');
    const [sku, setSku] = useState(initialData?.sku || '');
    const [stock, setStock] = useState(initialData?.quantity || '');
    const [moq, setMoq] = useState(initialData?.moq || '1');
    const [lowStockThreshold, setLowStockThreshold] = useState(initialData?.metadata?.low_stock_threshold || '5');
    const [description, setDescription] = useState(initialData?.description || '');
    const [status, setStatus] = useState(
        ['active', 'draft', 'archived'].includes(String(initialData?.status || '').toLowerCase())
            ? String(initialData.status).toLowerCase()
            : 'active'
    );
    const [featured, setFeatured] = useState(initialData?.featured || false);
    const [preorderShipping, setPreorderShipping] = useState(initialData?.metadata?.preorder_shipping || '');
    const [activeTab, setActiveTab] = useState('general');

    // Auto-generate SKU function
    const generateSku = () => {
        const prefix = 'UV';
        const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    };

    const existingVariants = (initialData?.product_variants || []).map((v: any) => ({
        ...v,
        stock: v.stock ?? v.quantity ?? 0,
        color: v.color ?? v.option2 ?? '',
        size: v.option1 || v.size || v.name || '',
        hex: v.metadata?.color_hex || '',
    }));

    const [selectedColors, setSelectedColors] = useState<{ name: string; hex: string }[]>(() => {
        const colors = new Map<string, string>();
        existingVariants.forEach((v: any) => {
            if (v.color) {
                colors.set(v.color, v.hex || colorHexForName(v.color));
            }
        });
        return Array.from(colors.entries()).map(([name, hex]) => ({ name, hex }));
    });

    const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
        const sizes = new Set<string>();
        existingVariants.forEach((v: any) => {
            if (v.size) sizes.add(v.size);
        });
        return Array.from(sizes);
    });

    const emptyVariantRow = (): VariantRow => ({
        price: price,
        stock: '0',
        sku: '',
        salePrice: '',
    });

    const [variantData, setVariantData] = useState<Record<string, VariantRow>>(() => {
        const data: Record<string, VariantRow> = {};
        existingVariants.forEach((v: any) => {
            const key = variantKey(v.color || '', v.size || '');
            data[key] = {
                price: v.price?.toString() || '',
                stock: v.stock?.toString() || '0',
                sku: v.sku || '',
                salePrice:
                    v.sale_price != null && v.sale_price !== ''
                        ? String(v.sale_price)
                        : '',
            };
        });
        return data;
    });

    // Computed: all variant combinations
    const variantCombinations = (() => {
        const combos: { color: string; colorHex: string; size: string; key: string }[] = [];
        const colors = selectedColors.length > 0 ? selectedColors : [{ name: '', hex: '' }];
        const sizes = selectedSizes.length > 0 ? selectedSizes : [''];

        for (const color of colors) {
            for (const size of sizes) {
                if (!color.name && !size) continue; // skip if both empty
                const key = variantKey(color.name, size);
                combos.push({ color: color.name, colorHex: color.hex, size, key });
            }
        }
        return combos;
    })();

    // Build the flat variants array for saving (used by handleSubmit)
    const variants = variantCombinations.map(combo => {
        const d = variantData[combo.key] || emptyVariantRow();
        return {
            name: combo.size,
            color: combo.color,
            sku: d.sku,
            price: d.price || price,
            salePrice: d.salePrice,
            stock: d.stock || '0',
        };
    });

    // Images
    const [images, setImages] = useState<any[]>(() =>
        [...(initialData?.product_images || [])]
            .sort((a: { position?: number }, b: { position?: number }) => (a.position ?? 0) - (b.position ?? 0))
            .map((img: { url: string; position?: number; alt_text?: string }, idx: number) => ({
                url: img.url,
                position: img.position ?? idx,
                alt_text: img.alt_text,
            }))
    );
    const [uploading, setUploading] = useState(false);

    // SEO
    const [seoTitle, setSeoTitle] = useState(initialData?.seo_title || '');
    const [metaDescription, setMetaDescription] = useState(initialData?.seo_description || '');
    const [urlSlug, setUrlSlug] = useState(initialData?.slug || '');
    const [keywords, setKeywords] = useState(
        Array.isArray(initialData?.tags) ? initialData.tags.join(', ') : ''
    );
    const [slugManual, setSlugManual] = useState(Boolean(isEditMode && initialData?.slug));
    const [seoTitleManual, setSeoTitleManual] = useState(Boolean(isEditMode && initialData?.seo_title));
    const [seoDescManual, setSeoDescManual] = useState(Boolean(isEditMode && initialData?.seo_description));
    const [keywordsManual, setKeywordsManual] = useState(Boolean(isEditMode && initialData?.tags?.length));
    const [focusKeyword, setFocusKeyword] = useState(initialData?.metadata?.seo_focus_keyword || '');

    const tabs = [
        { id: 'general', label: 'General', icon: 'ri-information-line' },
        { id: 'pricing', label: 'Pricing & Inventory', icon: 'ri-price-tag-3-line' },
        { id: 'variants', label: variants.length ? `Variants (${variants.length})` : 'Variants', icon: 'ri-layout-grid-line' },
        { id: 'images', label: 'Images', icon: 'ri-image-line' },
        { id: 'seo', label: 'SEO', icon: 'ri-search-line' }
    ];

    // Fetch categories on mount
    useEffect(() => {
        async function fetchCategories() {
            try {
                const data = await apiData<{ id: string; name: string }[]>('/api/catalog/categories');
                if (Array.isArray(data)) {
                    setCategories(data);
                    if (data.length > 0 && !categoryId) {
                        setCategoryId(data[0].id);
                    }
                }
            } catch (err) {
                console.error('Failed to load categories', err);
                setCategories([]);
            }
        }
        fetchCategories();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const applyGeneratedSeo = (force = false) => {
        if (!productName.trim()) return;
        const categoryName = categories.find((c) => c.id === categoryId)?.name || '';
        const seo = buildProductSeo({
            name: productName,
            description,
            categoryName,
            siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Upscale Vintage',
            focusKeyword: force ? '' : focusKeyword,
        });
        if (force || !slugManual) setUrlSlug(seo.slug);
        if (force || !seoTitleManual) setSeoTitle(seo.seo_title);
        if (force || !seoDescManual) setMetaDescription(seo.seo_description);
        if (force || !keywordsManual) setKeywords(seo.tags.join(', '));
        if (force || !focusKeyword) setFocusKeyword(seo.focus_keyword);
        if (force) {
            setSlugManual(false);
            setSeoTitleManual(false);
            setSeoDescManual(false);
            setKeywordsManual(false);
            setFocusKeyword(seo.focus_keyword);
        }
    };

    // Keep slug + SEO in sync with the name until the merchant edits those fields.
    useEffect(() => {
        applyGeneratedSeo(false);
    }, [productName, categoryId, categories, description]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-generate SKU for new products
    useEffect(() => {
        if (!isEditMode && !sku) {
            setSku(generateSku());
        }
    }, [isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!e.target.files || e.target.files.length === 0) return;

            setUploading(true);
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const form = new FormData();
            form.append('file', file);
            const uploaded = await fetch('/api/uploads', { method: 'POST', body: form, credentials: 'include' }).then(
                (r) => (r.ok ? r.json() : Promise.reject(new Error('Upload failed')))
            );
            setImages((prev) => [...prev, { url: uploaded.url, position: prev.length }]);

        } catch (error: any) {
            alert('Error uploading image: ' + error.message);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setImages((prev) =>
            prev.filter((_, idx) => idx !== indexToRemove).map((img, idx) => ({ ...img, position: idx }))
        );
    };

    const handleSetPrimaryImage = (index: number) => {
        if (index <= 0) return;
        setImages((prev) => {
            const next = [...prev];
            const [picked] = next.splice(index, 1);
            next.unshift(picked);
            return next.map((img, idx) => ({ ...img, position: idx }));
        });
    };

    // Variant helpers removed — variants are now auto-generated from selectedColors × selectedSizes

    const handleSubmit = async () => {
        try {
            setLoading(true);
            if (!productName.trim()) {
                throw new Error('Enter a product name on the General tab.');
            }
            if (!price || Number(price) < 0) {
                throw new Error('Enter a valid regular price.');
            }

            // If product has variants, auto-sync main stock = sum of variant stocks
            const hasVariants = variants.length > 0;
            const variantStockTotal = hasVariants
                ? variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
                : parseInt(stock) || 0;

            const salePriceNum = salePrice.trim() ? parseFloat(salePrice) : NaN;
            const nextSlug = slugifyProduct(urlSlug || productName);
            if (!nextSlug) {
                throw new Error('Add a product name so a URL slug can be generated.');
            }
            const productData = {
                name: productName.trim(),
                slug: nextSlug,
                description,
                category_id: categoryId || null,
                price: parseFloat(price) || 0,
                sale_price:
                    !Number.isNaN(salePriceNum) && salePriceNum > 0 ? salePriceNum : null,
                compare_at_price: comparePrice ? parseFloat(comparePrice) : null,
                sku: sku || generateSku(), // Auto-generate if empty
                quantity: hasVariants ? variantStockTotal : (parseInt(stock) || 0),
                moq: parseInt(moq) || 1,
                status: status.toLowerCase(),
                featured,
                seo_title: seoTitle,
                seo_description: metaDescription,
                tags: (keywords as string).split(',').map((k: string) => k.trim()).filter(Boolean),
                metadata: {
                    low_stock_threshold: parseInt(lowStockThreshold) || 5,
                    preorder_shipping: preorderShipping.trim() || null,
                    seo_focus_keyword: focusKeyword.trim() || null,
                }
            };

            let productId = initialData?.id;

            const payload = {
                ...productData,
                images: images.map((img, idx) => ({
                    url: img.url,
                    position: idx,
                    alt_text: productName,
                })),
                variants: variants.map((v) => {
                    const colorHex = selectedColors.find((c) => c.name === v.color)?.hex || null;
                    const vSale = v.salePrice?.trim() ? parseFloat(v.salePrice) : NaN;
                    return {
                        name: v.name || v.color || 'Default',
                        sku: v.sku || buildVariantSku(sku, v.color, v.name),
                        price: parseFloat(v.price) || 0,
                        sale_price: !Number.isNaN(vSale) && vSale > 0 ? vSale : null,
                        quantity: parseInt(v.stock) || 0,
                        option1: v.name || null,
                        option2: v.color?.trim() || null,
                        metadata: colorHex ? { color_hex: colorHex } : {},
                    };
                }),
            };

            if (isEditMode && productId) {
                await apiPatch(`/api/catalog/products/${productId}`, payload);
            } else {
                const created = await apiData<{ id: string }>('/api/catalog/products', {
                    method: 'POST',
                    body: payload,
                });
                productId = created.id;
            }

            alert(isEditMode ? 'Product updated successfully!' : 'Product created successfully!');
            router.push('/admin/products');

        } catch (err: any) {
            console.error('Error saving product:', err);
            alert(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link
                        href="/admin/products"
                        className="w-10 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                    >
                        <i className="ri-arrow-left-line text-xl text-gray-700"></i>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Product' : 'Add New Product'}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {isEditMode ? 'Update product information and settings' : 'Create a new product for your catalog'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {isEditMode && (
                        <Link
                            href={`/product/${initialData?.slug || initialData?.id}`}
                            target="_blank"
                            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-semibold whitespace-nowrap cursor-pointer flex items-center"
                        >
                            <i className="ri-eye-line mr-2"></i>
                            Preview
                        </Link>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`px-6 py-3 bg-store-navy hover:bg-store-navy text-white rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? (
                            <>
                                <i className="ri-loader-4-line animate-spin mr-2"></i>
                                Saving...
                            </>
                        ) : (
                            <>
                                <i className="ri-save-line mr-2"></i>
                                {isEditMode ? 'Save Changes' : 'Create Product'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200 overflow-x-auto">
                    <div className="flex">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-6 py-4 font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${activeTab === tab.id
                                    ? 'border-store-navy text-store-ink bg-store-surface'
                                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                            >
                                <i className={`${tab.icon} text-xl`}></i>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-8">
                    {activeTab === 'general' && (
                        <div className="space-y-6 max-w-3xl">
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">
                                    Product Name *
                                </label>
                                <input
                                    type="text"
                                    value={productName}
                                    onChange={(e) => setProductName(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary"
                                    placeholder="Enter product name"
                                />
                            </div>

                            {productName.trim() && (
                                <p className="text-sm text-gray-600 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                                    URL slug and SEO fields are on the <strong>SEO</strong> tab
                                    {urlSlug ? (
                                        <>
                                            {' '}
                                            (<span className="font-mono">/product/{urlSlug}</span>
                                            {!slugManual && ', updates with the name'})
                                        </>
                                    ) : null}
                                    .
                                </p>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={6}
                                    maxLength={500}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary resize-none"
                                    placeholder="Describe your product..."
                                />
                                <p className="text-sm text-gray-500 mt-2">{description.length}/500 characters</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                                        Category *
                                    </label>
                                    <select
                                        value={categoryId}
                                        onChange={(e) => setCategoryId(e.target.value)}
                                        className="w-full px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary cursor-pointer"
                                    >
                                        {categories.length === 0 && (
                                            <option value="">No categories yet — add one under Categories</option>
                                        )}
                                        {categories.length > 0 && <option value="">Select a category</option>}
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                                        Status
                                    </label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary cursor-pointer"
                                    >
                                        <option value="active">Active</option>
                                        <option value="draft">Draft</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    checked={featured}
                                    onChange={(e) => setFeatured(e.target.checked)}
                                    className="w-5 h-5 text-store-ink border-gray-300 rounded focus:ring-store-primary cursor-pointer"
                                />
                                <label className="text-gray-900 font-medium">
                                    Feature this product on homepage
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">
                                    Pre-order / Estimated Shipping
                                </label>
                                <input
                                    type="text"
                                    value={preorderShipping}
                                    onChange={(e) => setPreorderShipping(e.target.value)}
                                    placeholder="e.g., Ships in 14 days, Available March 15"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-store-primary focus:border-store-primary transition-all"
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave empty if product ships immediately. Otherwise, enter estimated shipping time.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pricing' && (
                        <div className="space-y-6 max-w-3xl">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                                        Regular price (GH₵) *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">GH₵</span>
                                        <input
                                            type="number"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            className="w-full pl-16 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary"
                                            step="0.01"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                                        Sale price (GH₵)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">GH₵</span>
                                        <input
                                            type="number"
                                            value={salePrice}
                                            onChange={(e) => setSalePrice(e.target.value)}
                                            className="w-full pl-16 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary"
                                            step="0.01"
                                            placeholder="Optional"
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Used only when <strong>Store-wide sale</strong> is ON in Admin → Sale pricing. Leave empty to keep regular price during sales.
                                    </p>
                                    <div className="mt-3">
                                        <Link
                                            href="/admin/sales"
                                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-store-ink border border-gray-200 rounded-lg hover:bg-store-surface"
                                        >
                                            <i className="ri-price-tag-2-line"></i>
                                            Open Sale Pricing Toggle
                                        </Link>
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                                        Compare at Price (GH₵)
                                    </label>
                                    <div className="relative max-w-md">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">GH₵</span>
                                        <input
                                            type="number"
                                            value={comparePrice}
                                            onChange={(e) => setComparePrice(e.target.value)}
                                            className="w-full pl-16 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary"
                                            step="0.01"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2">Optional “was” price when not in site-wide sale mode</p>
                                </div>
                            </div>

                            <div className="p-4 bg-store-surface border border-gray-200 rounded-lg">
                                <p className="text-store-ink font-semibold mb-1">Discount Calculation</p>
                                {price && comparePrice && parseFloat(comparePrice) > parseFloat(price) ? (
                                    <p className="text-store-ink">
                                        Savings: GH₵ {(parseFloat(comparePrice) - parseFloat(price)).toFixed(2)}
                                        <span className="ml-2">
                                            ({(((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100).toFixed(0)}% off)
                                        </span>
                                    </p>
                                ) : (
                                    <p className="text-store-ink text-sm">Enter a valid compare price higher than the price to see discount.</p>
                                )}
                            </div>

                            <div className="pt-6 border-t border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Inventory</h3>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                                            SKU (Auto-generated)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={sku}
                                                onChange={(e) => setSku(e.target.value)}
                                                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary font-mono bg-gray-50"
                                                placeholder="Auto-generated"
                                                readOnly
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setSku(generateSku())}
                                                className="px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-store-primary hover:bg-store-surface transition-colors cursor-pointer"
                                                title="Generate new SKU"
                                            >
                                                <i className="ri-refresh-line text-lg"></i>
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">SKU is auto-generated. Click refresh to generate a new one.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                                            Stock Quantity *
                                        </label>
                                        {variants.length > 0 ? (
                                            <div>
                                                <input
                                                    type="number"
                                                    value={variants.reduce((sum: number, v: any) => sum + (parseInt(v.stock) || 0), 0)}
                                                    readOnly
                                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                                />
                                                <p className="text-sm text-amber-600 mt-1 flex items-center">
                                                    <i className="ri-information-line mr-1"></i>
                                                    Stock is managed per variant. Edit stock in the Variants tab.
                                                </p>
                                            </div>
                                        ) : (
                                            <input
                                                type="number"
                                                value={stock}
                                                onChange={(e) => setStock(e.target.value)}
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary"
                                                placeholder="0"
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 mt-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                                            Minimum Order Quantity (MOQ)
                                        </label>
                                        <input
                                            type="number"
                                            value={moq}
                                            onChange={(e) => setMoq(e.target.value)}
                                            min="1"
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary"
                                            placeholder="1"
                                        />
                                        <p className="text-sm text-gray-500 mt-1">Minimum quantity customers must order</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                                            Low Stock Threshold
                                        </label>
                                        <input
                                            type="number"
                                            value={lowStockThreshold}
                                            onChange={(e) => setLowStockThreshold(e.target.value)}
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary"
                                        />
                                        <p className="text-sm text-gray-500 mt-1">Get notified when stock falls below this number</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'variants' && (
                        <ProductVariantsEditor
                            productPrice={String(price || '')}
                            productSku={sku}
                            lowStockThreshold={parseInt(String(lowStockThreshold), 10) || 5}
                            selectedColors={selectedColors}
                            selectedSizes={selectedSizes}
                            variantData={variantData}
                            onColorsChange={setSelectedColors}
                            onSizesChange={setSelectedSizes}
                            onVariantDataChange={setVariantData}
                        />
                    )}

                    {activeTab === 'images' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Product Images</h3>
                                <p className="text-gray-600">Add up to 10 images. First image will be the primary image.</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {images.map((img: any, index: number) => (
                                    <div key={img.url || `img-${index}`} className="relative group">
                                        <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
                                            <img src={img.url} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                                        </div>
                                        {index === 0 && (
                                            <span className="absolute top-2 left-2 bg-store-navy text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                                                Primary
                                            </span>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 rounded-xl">
                                            <a href={img.url} target="_blank" rel="noreferrer" className="w-9 h-9 flex items-center justify-center bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                                                <i className="ri-eye-line"></i>
                                            </a>
                                            {index > 0 && (
                                                <button
                                                    type="button"
                                                    title="Set as primary"
                                                    onClick={() => handleSetPrimaryImage(index)}
                                                    className="w-9 h-9 flex items-center justify-center bg-white text-store-ink rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                                                >
                                                    <i className="ri-star-line"></i>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveImage(index)}
                                                className="w-9 h-9 flex items-center justify-center bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                            >
                                                <i className="ri-delete-bin-line"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <label className={`aspect-square border-2 border-dashed border-gray-300 rounded-xl hover:border-store-navy hover:bg-store-surface transition-colors flex flex-col items-center justify-center space-y-2 text-gray-600 hover:text-store-ink cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {uploading ? (
                                        <i className="ri-loader-4-line animate-spin text-3xl"></i>
                                    ) : (
                                        <i className="ri-upload-2-line text-3xl"></i>
                                    )}
                                    <span className="text-sm font-semibold">{uploading ? 'Uploading...' : 'Upload Image'}</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                    />
                                </label>
                            </div>

                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-sm text-gray-700">
                                    <strong>Image Guidelines:</strong> Use high-quality images (min 1000x1000px), white or neutral backgrounds work best.
                                    Supported formats: JPG, PNG, WebP (max 5MB each).
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'seo' && (
                        <ProductSeoEditor
                            productName={productName}
                            description={description}
                            categoryName={categories.find((c) => c.id === categoryId)?.name || ''}
                            siteName={process.env.NEXT_PUBLIC_SITE_NAME || 'Upscale Vintage'}
                            productId={initialData?.id}
                            primaryImage={images[0]?.url}
                            slug={urlSlug}
                            seoTitle={seoTitle}
                            seoDescription={metaDescription}
                            keywords={keywords}
                            focusKeyword={focusKeyword}
                            slugManual={slugManual}
                            onSlugChange={(value, manual) => {
                                setSlugManual(manual);
                                setUrlSlug(value);
                            }}
                            onTitleChange={(value, manual) => {
                                setSeoTitleManual(manual);
                                setSeoTitle(value);
                            }}
                            onDescriptionChange={(value, manual) => {
                                setSeoDescManual(manual);
                                setMetaDescription(value);
                            }}
                            onKeywordsChange={(value, manual) => {
                                setKeywordsManual(manual);
                                setKeywords(value);
                            }}
                            onFocusChange={setFocusKeyword}
                            onRebuild={() => applyGeneratedSeo(true)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
