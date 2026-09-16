import { CONTACT_ADDRESS } from '@/lib/brand';

export type DeliveryOrderLike = {
  shipping_method?: string | null;
  metadata?: Record<string, unknown> | null;
} | null | undefined;

export function resolveDeliveryMethod(order: DeliveryOrderLike): string {
  const fromMeta = order?.metadata?.delivery_method;
  const raw = String(fromMeta || order?.shipping_method || '')
    .trim()
    .toLowerCase();
  return raw;
}

export function isStorePickup(method: string): boolean {
  return method === 'pickup' || method === 'store_pickup' || method === 'store-pickup';
}

export function formatDeliveryMethod(method: string): string {
  switch (method) {
    case 'pickup':
    case 'store_pickup':
    case 'store-pickup':
      return 'Store Pickup';
    case 'doorstep':
      return 'Doorstep Delivery';
    case 'accra':
      return 'Accra Delivery';
    case 'outside-accra':
      return 'Outside Accra Delivery';
    case 'express':
      return 'Express Delivery';
    case 'standard':
      return 'Standard Delivery';
    default:
      return method
        ? method.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Not specified';
  }
}

export function deliveryMethodHint(method: string): string {
  if (isStorePickup(method)) return 'Pick up from our store — ready in 24 hours';
  if (method === 'doorstep') return 'We will contact you with the delivery cost';
  return '';
}

export function pickupLocation(): string {
  return CONTACT_ADDRESS;
}
