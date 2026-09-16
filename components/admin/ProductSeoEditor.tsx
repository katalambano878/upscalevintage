'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiData } from '@/lib/client/api';
import {
  buildSeoTitle,
  scoreProductSeo,
  slugifyProduct,
  type SeoTitleTemplate,
} from '@/lib/product-seo';

type Props = {
  productName: string;
  description: string;
  categoryName: string;
  siteName: string;
  productId?: string;
  primaryImage?: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  focusKeyword: string;
  slugManual: boolean;
  onSlugChange: (value: string, manual: boolean) => void;
  onTitleChange: (value: string, manual: boolean) => void;
  onDescriptionChange: (value: string, manual: boolean) => void;
  onKeywordsChange: (value: string, manual: boolean) => void;
  onFocusChange: (value: string) => void;
  onRebuild: () => void;
};

export default function ProductSeoEditor({
  productName,
  description,
  categoryName,
  siteName,
  productId,
  primaryImage,
  slug,
  seoTitle,
  seoDescription,
  keywords,
  focusKeyword,
  slugManual,
  onSlugChange,
  onTitleChange,
  onDescriptionChange,
  onKeywordsChange,
  onFocusChange,
  onRebuild,
}: Props) {
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [copied, setCopied] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState('');

  const keywordList = useMemo(
    () =>
      keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    [keywords]
  );

  const scored = useMemo(
    () =>
      scoreProductSeo({
        name: productName,
        slug,
        seoTitle,
        seoDescription,
        keywords: keywordList,
        focusKeyword,
        hasImage: Boolean(primaryImage),
      }),
    [productName, slug, seoTitle, seoDescription, keywordList, focusKeyword, primaryImage]
  );

  useEffect(() => {
    if (!slug || slug.length < 2) {
      setSlugStatus('idle');
      return;
    }
    const timer = setTimeout(async () => {
      setSlugStatus('checking');
      try {
        const result = await apiData<{ available: boolean }>(
          `/api/catalog/products/slug-check?slug=${encodeURIComponent(slug)}${
            productId ? `&exclude=${encodeURIComponent(productId)}` : ''
          }`
        );
        setSlugStatus(result.available ? 'ok' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [slug, productId]);

  const applyTemplate = (template: SeoTitleTemplate) => {
    onTitleChange(
      buildSeoTitle(
        { name: productName, categoryName, siteName, focusKeyword },
        template
      ),
      true
    );
  };

  const addKeyword = (raw: string) => {
    const next = raw.trim();
    if (!next) return;
    if (keywordList.some((k) => k.toLowerCase() === next.toLowerCase())) return;
    onKeywordsChange([...keywordList, next].join(', '), true);
    setKeywordDraft('');
  };

  const removeKeyword = (value: string) => {
    onKeywordsChange(
      keywordList.filter((k) => k !== value).join(', '),
      true
    );
  };

  const scoreTone =
    scored.score >= 80 ? 'text-green-700 bg-green-50 border-green-200' : scored.score >= 55 ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';

  const liveUrl = `upscalevintage.shop/product/${slug || '…'}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Search Engine Optimization</h3>
          <p className="text-gray-600">
            Title, slug, and description stay in sync with the product name until you edit them.
          </p>
        </div>
        <button
          type="button"
          onClick={onRebuild}
          className="px-4 py-2 border-2 border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50"
        >
          <i className="ri-refresh-line mr-1"></i>
          Rebuild from name
        </button>
      </div>

      <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${scoreTone}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">SEO score</p>
          <p className="text-3xl font-bold">{scored.score}</p>
        </div>
        <p className="text-sm max-w-sm">
          {scored.score >= 80
            ? 'Ready to rank. Keep the focus keyword in the title and slug.'
            : 'Fix the red items below. A real product name and a 110–160 character description move the score fastest.'}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Google preview</p>
          <p className="text-[#1a0dab] text-xl leading-snug">{seoTitle || 'Page title appears here'}</p>
          <p className="text-sm text-[#006621] mt-0.5">{liveUrl}</p>
          <p className="text-sm text-[#4d5156] mt-1">{seoDescription || 'Meta description appears here.'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <p className="text-xs font-semibold text-gray-500 px-4 pt-3">WhatsApp / social card</p>
          <div className="aspect-[1.91/1] bg-gray-100 mt-2">
            {primaryImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={primaryImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                Add a product image for the share card
              </div>
            )}
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] uppercase text-gray-400">upscalevintage.shop</p>
            <p className="font-semibold text-gray-900 line-clamp-2">{seoTitle || productName || 'Product title'}</p>
            <p className="text-sm text-gray-600 line-clamp-2">{seoDescription || 'Description'}</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Focus keyword</label>
        <input
          type="text"
          value={focusKeyword}
          onChange={(e) => onFocusChange(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
          placeholder="e.g. navy linen shirt"
        />
        <p className="text-sm text-gray-500 mt-2">Used in the title, description, slug check, and tags.</p>
      </div>

      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          <TemplateButton label="Buy in Ghana" onClick={() => applyTemplate('buy-ghana')} />
          <TemplateButton label="Name | Brand" onClick={() => applyTemplate('brand')} />
          <TemplateButton label="Name – Category" onClick={() => applyTemplate('category')} />
        </div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Page title</label>
        <input
          type="text"
          value={seoTitle}
          maxLength={70}
          onChange={(e) => onTitleChange(e.target.value, true)}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
        />
        <Meter value={seoTitle.length} idealMin={30} idealMax={60} hardMax={70} />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Meta description</label>
        <textarea
          rows={3}
          maxLength={200}
          value={seoDescription}
          onChange={(e) => onDescriptionChange(e.target.value, true)}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg resize-none"
        />
        <Meter value={seoDescription.length} idealMin={110} idealMax={160} hardMax={200} />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">URL slug</label>
        <div className="flex items-center min-w-0">
          <span className="text-gray-600 bg-gray-100 px-4 py-3 border-2 border-r-0 border-gray-300 rounded-l-lg text-sm whitespace-nowrap">
            /product/
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => onSlugChange(slugifyProduct(e.target.value), true)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 px-4 py-3 border-2 border-gray-300 rounded-r-lg font-mono"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
          <span className="text-gray-500">
            {slugManual ? 'Manual slug' : 'Updates from the product name'}
          </span>
          {slugStatus === 'checking' && <span className="text-gray-500">Checking…</span>}
          {slugStatus === 'ok' && <span className="text-green-700 font-semibold">Available</span>}
          {slugStatus === 'taken' && <span className="text-red-700 font-semibold">Already used — save will add -2</span>}
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(`https://upscalevintage.shop/product/${slug}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-store-ink font-semibold"
          >
            {copied ? 'Copied' : 'Copy URL'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Keywords</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {keywordList.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => removeKeyword(word)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
            >
              {word}
              <i className="ri-close-line text-gray-500"></i>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addKeyword(keywordDraft.replace(',', ''));
              }
            }}
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg"
            placeholder="Add a keyword and press Enter"
          />
          <button
            type="button"
            onClick={() => addKeyword(keywordDraft)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold"
          >
            Add
          </button>
        </div>
      </div>

      <ul className="grid sm:grid-cols-2 gap-2">
        {scored.checks.map((check) => (
          <li
            key={check.id}
            className={`flex items-start gap-2 text-sm rounded-lg border px-3 py-2 ${
              check.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            <i className={`${check.ok ? 'ri-checkbox-circle-fill text-green-600' : 'ri-close-circle-line text-gray-400'} mt-0.5`}></i>
            {check.label}
          </li>
        ))}
      </ul>

      {!productName.trim() && (
        <p className="text-sm text-amber-700">Add a product name on the General tab so SEO can generate properly.</p>
      )}
      {description.trim().length < 40 && (
        <p className="text-sm text-gray-500">
          A longer description on the General tab makes a stronger default meta description.
        </p>
      )}
    </div>
  );
}

function TemplateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50">
      {label}
    </button>
  );
}

function Meter({
  value,
  idealMin,
  idealMax,
  hardMax,
}: {
  value: number;
  idealMin: number;
  idealMax: number;
  hardMax: number;
}) {
  const pct = Math.min(100, Math.round((value / hardMax) * 100));
  const good = value >= idealMin && value <= idealMax;
  const over = value > idealMax;
  return (
    <div className="mt-2">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${good ? 'bg-green-600' : over ? 'bg-amber-500' : 'bg-gray-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-sm mt-1 ${good ? 'text-green-700' : over ? 'text-amber-700' : 'text-gray-500'}`}>
        {value}/{idealMax} recommended
      </p>
    </div>
  );
}
