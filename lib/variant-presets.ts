export type ColorPreset = { name: string; hex: string };

export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'Black', hex: '#111827' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Ivory', hex: '#FFFFF0' },
  { name: 'Cream', hex: '#FFFDD0' },
  { name: 'Beige', hex: '#D2B48C' },
  { name: 'Brown', hex: '#92400E' },
  { name: 'Tan', hex: '#D2A679' },
  { name: 'Navy', hex: '#1E3A5F' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Sky', hex: '#0EA5E9' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Olive', hex: '#84CC16' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Lavender', hex: '#E6E6FA' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Gold', hex: '#D4AF37' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Gray', hex: '#6B7280' },
  { name: 'Charcoal', hex: '#374151' },
  { name: 'Silver', hex: '#C0C0C0' },
];

export type SizePack = {
  id: string;
  label: string;
  hint: string;
  sizes: string[];
};

export const SIZE_PACKS: SizePack[] = [
  { id: 'clothing', label: 'Clothing', hint: 'XS–3XL', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  { id: 'plus', label: 'Plus', hint: '4XL–6XL', sizes: ['4XL', '5XL', '6XL'] },
  { id: 'onesize', label: 'One size', hint: 'Bags & accessories', sizes: ['One Size'] },
  { id: 'shoes', label: 'Shoes EU', hint: '36–45', sizes: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'] },
  { id: 'volume', label: 'Volume', hint: 'Beauty / fragrance', sizes: ['30ml', '50ml', '100ml', '200ml'] },
];

export function colorHexForName(name: string, fallback = '#888888'): string {
  const preset = COLOR_PRESETS.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return preset?.hex || fallback;
}

export function variantSkuCode(value: string, fallback: string): string {
  const compact = value.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return compact.slice(0, 4) || fallback;
}

export function buildVariantSku(productSku: string, color: string, size: string): string {
  const root = (productSku || 'UV').split('-')[0].replace(/[^A-Z0-9]/gi, '').slice(0, 6) || 'UV';
  const colorCode = variantSkuCode(color, 'CLR');
  const sizeCode = variantSkuCode(size, 'OS');
  if (color && size) return `${root}-${colorCode}-${sizeCode}`;
  if (color) return `${root}-${colorCode}`;
  if (size) return `${root}-${sizeCode}`;
  return `${root}-VAR`;
}

export function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (next < 0 || next >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}
