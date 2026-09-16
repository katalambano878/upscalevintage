'use client';

import { useMemo, useState } from 'react';
import {
  COLOR_PRESETS,
  SIZE_PACKS,
  buildVariantSku,
  colorHexForName,
  moveItem,
  type ColorPreset,
} from '@/lib/variant-presets';

export type VariantRow = {
  price: string;
  stock: string;
  sku: string;
  salePrice: string;
};

export function variantKey(color: string, size: string) {
  return `${color}|||${size}`;
}

type Props = {
  productPrice: string;
  productSku: string;
  lowStockThreshold: number;
  selectedColors: ColorPreset[];
  selectedSizes: string[];
  variantData: Record<string, VariantRow>;
  onColorsChange: (colors: ColorPreset[]) => void;
  onSizesChange: (sizes: string[]) => void;
  onVariantDataChange: (data: Record<string, VariantRow>) => void;
};

function emptyRow(productPrice: string): VariantRow {
  return { price: productPrice, stock: '0', sku: '', salePrice: '' };
}

export default function ProductVariantsEditor({
  productPrice,
  productSku,
  lowStockThreshold,
  selectedColors,
  selectedSizes,
  variantData,
  onColorsChange,
  onSizesChange,
  onVariantDataChange,
}: Props) {
  const [customColorName, setCustomColorName] = useState('');
  const [customColorHex, setCustomColorHex] = useState('#8A6A58');
  const [customSize, setCustomSize] = useState('');
  const [filterColor, setFilterColor] = useState('all');
  const [bulkPrice, setBulkPrice] = useState(productPrice || '');
  const [bulkStock, setBulkStock] = useState('');
  const [bulkSale, setBulkSale] = useState('');

  const combinations = useMemo(() => {
    const colors = selectedColors.length ? selectedColors : [{ name: '', hex: '' }];
    const sizes = selectedSizes.length ? selectedSizes : [''];
    const combos: { color: string; colorHex: string; size: string; key: string }[] = [];
    for (const color of colors) {
      for (const size of sizes) {
        if (!color.name && !size) continue;
        combos.push({
          color: color.name,
          colorHex: color.hex,
          size,
          key: variantKey(color.name, size),
        });
      }
    }
    return combos;
  }, [selectedColors, selectedSizes]);

  const visible = combinations.filter((c) => filterColor === 'all' || c.color === filterColor);

  const stats = useMemo(() => {
    let units = 0;
    let out = 0;
    let low = 0;
    for (const combo of combinations) {
      const stock = parseInt(variantData[combo.key]?.stock || '0', 10) || 0;
      units += stock;
      if (stock <= 0) out += 1;
      else if (stock <= lowStockThreshold) low += 1;
    }
    return { units, out, low, ok: combinations.length - out - low };
  }, [combinations, variantData, lowStockThreshold]);

  const toggleColor = (color: ColorPreset) => {
    const exists = selectedColors.some((c) => c.name === color.name);
    onColorsChange(exists ? selectedColors.filter((c) => c.name !== color.name) : [...selectedColors, color]);
  };

  const toggleSize = (size: string) => {
    onSizesChange(selectedSizes.includes(size) ? selectedSizes.filter((s) => s !== size) : [...selectedSizes, size]);
  };

  const applyPack = (sizes: string[], replace: boolean) => {
    if (replace) {
      onSizesChange(sizes);
      return;
    }
    const next = [...selectedSizes];
    for (const size of sizes) {
      if (!next.includes(size)) next.push(size);
    }
    onSizesChange(next);
  };

  const updateRow = (key: string, field: keyof VariantRow, value: string) => {
    onVariantDataChange({
      ...variantData,
      [key]: { ...(variantData[key] || emptyRow(productPrice)), [field]: value },
    });
  };

  const applyBulk = (field: keyof VariantRow, value: string) => {
    if (value === '') return;
    const next = { ...variantData };
    for (const combo of visible) {
      next[combo.key] = { ...(next[combo.key] || emptyRow(productPrice)), [field]: value };
    }
    onVariantDataChange(next);
  };

  const generateSkus = () => {
    const next = { ...variantData };
    for (const combo of combinations) {
      const current = next[combo.key] || emptyRow(productPrice);
      next[combo.key] = {
        ...current,
        sku: current.sku || buildVariantSku(productSku, combo.color, combo.size),
      };
    }
    onVariantDataChange(next);
  };

  const fillMissingPrices = () => {
    const next = { ...variantData };
    for (const combo of combinations) {
      const current = next[combo.key] || emptyRow(productPrice);
      if (!current.price) {
        next[combo.key] = { ...current, price: productPrice || '0' };
      }
    }
    onVariantDataChange(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Variants</h3>
          <p className="text-gray-600 mt-1">
            Pick colors and sizes. The shop builds a grid automatically — same as customers see on the product page.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-[280px]">
          <Stat label="Combos" value={combinations.length} />
          <Stat label="Units" value={stats.units} />
          <Stat label="Low" value={stats.low} tone={stats.low ? 'amber' : 'ok'} />
          <Stat label="Out" value={stats.out} tone={stats.out ? 'red' : 'ok'} />
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-900">
            <i className="ri-palette-line mr-2 text-store-ink"></i>
            Colors
            {selectedColors.length > 0 && (
              <span className="ml-2 bg-white border border-gray-200 text-xs px-2 py-0.5 rounded-full">
                {selectedColors.length}
              </span>
            )}
          </h4>
          {selectedColors.length > 0 && (
            <button type="button" onClick={() => onColorsChange([])} className="text-xs font-semibold text-gray-500 hover:text-red-600">
              Clear colors
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {COLOR_PRESETS.map((color) => {
            const selected = selectedColors.some((c) => c.name === color.name);
            return (
              <button
                key={color.name}
                type="button"
                onClick={() => toggleColor(color)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium ${
                  selected ? 'border-store-navy bg-white ring-1 ring-store-navy/20' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="w-5 h-5 rounded-full border border-gray-300" style={{ backgroundColor: color.hex }} />
                {color.name}
                {selected && <i className="ri-check-line text-store-ink"></i>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-200">
          <input
            type="color"
            value={customColorHex}
            onChange={(e) => setCustomColorHex(e.target.value)}
            className="w-12 h-11 rounded-lg border border-gray-300 cursor-pointer p-1 bg-white"
          />
          <input
            type="text"
            value={customColorName}
            onChange={(e) => setCustomColorName(e.target.value)}
            placeholder="Custom color name, e.g. Espresso"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!customColorName.trim()) return;
                toggleColor({ name: customColorName.trim(), hex: customColorHex });
                setCustomColorName('');
              }
            }}
          />
          <button
            type="button"
            disabled={!customColorName.trim()}
            onClick={() => {
              toggleColor({ name: customColorName.trim(), hex: customColorHex });
              setCustomColorName('');
            }}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold disabled:opacity-40"
          >
            Add color
          </button>
        </div>
        {selectedColors.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedColors.map((color, index) => (
              <span key={color.name} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-full text-sm">
                <button type="button" onClick={() => onColorsChange(moveItem(selectedColors, index, -1))} className="text-gray-400 hover:text-gray-700">
                  <i className="ri-arrow-left-s-line"></i>
                </button>
                <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: color.hex }} />
                {color.name}
                <button type="button" onClick={() => onColorsChange(moveItem(selectedColors, index, 1))} className="text-gray-400 hover:text-gray-700">
                  <i className="ri-arrow-right-s-line"></i>
                </button>
                <button type="button" onClick={() => toggleColor(color)} className="text-gray-400 hover:text-red-500">
                  <i className="ri-close-line"></i>
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-900">
            <i className="ri-ruler-line mr-2 text-store-ink"></i>
            Sizes
            {selectedSizes.length > 0 && (
              <span className="ml-2 bg-white border border-gray-200 text-xs px-2 py-0.5 rounded-full">
                {selectedSizes.length}
              </span>
            )}
          </h4>
          {selectedSizes.length > 0 && (
            <button type="button" onClick={() => onSizesChange([])} className="text-xs font-semibold text-gray-500 hover:text-red-600">
              Clear sizes
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {SIZE_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => applyPack(pack.sizes, true)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:border-store-navy"
              title={pack.hint}
            >
              <span className="font-semibold">{pack.label}</span>
              <span className="text-gray-500 ml-1 text-xs">{pack.hint}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {SIZE_PACKS.flatMap((pack) => pack.sizes)
            .filter((size, i, all) => all.indexOf(size) === i)
            .map((size) => {
              const selected = selectedSizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold ${
                    selected ? 'border-store-navy bg-white text-store-ink' : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  {size}
                </button>
              );
            })}
        </div>
        <div className="flex gap-2 pt-3 border-t border-gray-200">
          <input
            type="text"
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            placeholder="Custom: 42, 100ml, Free size"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (customSize.trim() && !selectedSizes.includes(customSize.trim())) {
                  onSizesChange([...selectedSizes, customSize.trim()]);
                  setCustomSize('');
                }
              }
            }}
          />
          <button
            type="button"
            disabled={!customSize.trim()}
            onClick={() => {
              if (customSize.trim() && !selectedSizes.includes(customSize.trim())) {
                onSizesChange([...selectedSizes, customSize.trim()]);
                setCustomSize('');
              }
            }}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold disabled:opacity-40"
          >
            Add size
          </button>
        </div>
      </section>

      {combinations.length === 0 ? (
        <div className="p-10 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <i className="ri-layout-grid-line text-4xl text-gray-300 mb-2 block"></i>
          <p className="font-semibold text-gray-700">No variants yet</p>
          <p className="text-sm mt-1">Add colors, sizes, or both. Skip this tab for a simple one-price product.</p>
        </div>
      ) : (
        <section className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <h4 className="text-sm font-bold text-gray-900">
              Price, stock and SKU · {visible.length} row{visible.length === 1 ? '' : 's'}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              {selectedColors.length > 1 && (
                <select
                  value={filterColor}
                  onChange={(e) => setFilterColor(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="all">All colors</option>
                  {selectedColors.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" onClick={generateSkus} className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold">
                Fill SKUs
              </button>
              <button type="button" onClick={fillMissingPrices} className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold">
                Fill prices
              </button>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-end bg-white">
            <BulkField label="Price" value={bulkPrice} onChange={setBulkPrice} onApply={() => applyBulk('price', bulkPrice)} />
            <BulkField label="Sale" value={bulkSale} onChange={setBulkSale} onApply={() => applyBulk('salePrice', bulkSale)} />
            <BulkField label="Stock" value={bulkStock} onChange={setBulkStock} onApply={() => applyBulk('stock', bulkStock)} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {selectedColors.length > 0 && <th className="text-left py-3 px-4 font-semibold text-gray-700">Color</th>}
                  {selectedSizes.length > 0 && <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>}
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Price</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Sale</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Stock</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">SKU</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((combo) => {
                  const row = variantData[combo.key] || emptyRow(productPrice);
                  const stock = parseInt(row.stock || '0', 10) || 0;
                  const tone = stock <= 0 ? 'text-red-600' : stock <= lowStockThreshold ? 'text-amber-700' : 'text-green-700';
                  return (
                    <tr key={combo.key} className="border-b border-gray-100">
                      {selectedColors.length > 0 && (
                        <td className="py-2 px-4">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: combo.colorHex || colorHexForName(combo.color) }} />
                            {combo.color}
                          </span>
                        </td>
                      )}
                      {selectedSizes.length > 0 && <td className="py-2 px-4 font-medium">{combo.size}</td>}
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          value={row.price}
                          onChange={(e) => updateRow(combo.key, 'price', e.target.value)}
                          className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg"
                          step="0.01"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          value={row.salePrice}
                          onChange={(e) => updateRow(combo.key, 'salePrice', e.target.value)}
                          className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg"
                          step="0.01"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={row.stock}
                            onChange={(e) => updateRow(combo.key, 'stock', e.target.value)}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg"
                          />
                          <span className={`text-xs font-semibold ${tone}`}>
                            {stock <= 0 ? 'Out' : stock <= lowStockThreshold ? 'Low' : 'In'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={row.sku}
                          onChange={(e) => updateRow(combo.key, 'sku', e.target.value.toUpperCase())}
                          className="w-36 px-2 py-1.5 border border-gray-300 rounded-lg font-mono text-xs"
                          placeholder={buildVariantSku(productSku, combo.color, combo.size)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'ok' }: { label: string; value: number; tone?: 'ok' | 'amber' | 'red' }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-gray-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function BulkField({
  label,
  value,
  onChange,
  onApply,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <label className="text-xs text-gray-600">
      {label}
      <span className="flex gap-1 mt-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
        />
        <button type="button" onClick={onApply} className="px-2 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold">
          Apply
        </button>
      </span>
    </label>
  );
}
