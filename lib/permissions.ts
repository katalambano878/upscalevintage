import type { AuthUser, UserRole } from '@/lib/auth';

export const PERMISSIONS = [
  { key: 'orders.view', label: 'View orders', group: 'Shop floor' },
  { key: 'orders.update', label: 'Update orders', group: 'Shop floor' },
  { key: 'pos.use', label: 'Use the till', group: 'Shop floor' },
  { key: 'customers.view', label: 'Look up customers', group: 'Shop floor' },
  { key: 'end_of_day', label: 'End of day', group: 'Shop floor' },
  { key: 'sales.manage', label: 'Sale pricing', group: 'Shop floor' },
  { key: 'payments.view', label: 'Payments', group: 'Shop floor' },
  { key: 'products.manage', label: 'Products', group: 'Catalog' },
  { key: 'categories.manage', label: 'Categories', group: 'Catalog' },
  { key: 'inventory.manage', label: 'Inventory', group: 'Catalog' },
  { key: 'reviews.manage', label: 'Reviews', group: 'Catalog' },
  { key: 'coupons.manage', label: 'Coupons', group: 'Marketing' },
  { key: 'analytics.view', label: 'Analytics', group: 'Marketing' },
  { key: 'blog.manage', label: 'Blog', group: 'Marketing' },
  { key: 'notifications.send', label: 'Notifications and SMS', group: 'Marketing' },
  { key: 'settings.manage', label: 'Modules and settings', group: 'Settings' },
] as const;

export type StorePermission = (typeof PERMISSIONS)[number]['key'];
export type PermissionKey = StorePermission | 'staff.manage';

const STORE_KEYS = PERMISSIONS.map((item) => item.key);

export const PRESETS: {
  id: string;
  label: string;
  description: string;
  permissions: StorePermission[];
}[] = [
  {
    id: 'cashier',
    label: 'Cashier',
    description: 'Till, customer lookup, orders, and end of day.',
    permissions: ['pos.use', 'customers.view', 'orders.view', 'end_of_day'],
  },
  {
    id: 'sales',
    label: 'Sales',
    description: 'Cashier access, plus updating orders and sale prices.',
    permissions: ['pos.use', 'customers.view', 'orders.view', 'orders.update', 'end_of_day', 'sales.manage'],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    description: 'Products, categories, inventory, and reviews.',
    permissions: ['products.manage', 'categories.manage', 'inventory.manage', 'reviews.manage'],
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Every store tool except adding and limiting staff.',
    permissions: [...STORE_KEYS],
  },
];

export function parsePermissionList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? safeParse(value)
      : [];
  return raw.filter((item): item is string => typeof item === 'string');
}

function safeParse(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isStorePermission(value: string): value is StorePermission {
  return (STORE_KEYS as readonly string[]).includes(value);
}

export function cleanStaffPermissions(value: unknown): StorePermission[] {
  const unique = new Set<StorePermission>();
  for (const item of parsePermissionList(value)) {
    if (isStorePermission(item)) unique.add(item);
  }
  return [...unique];
}

/** What this signed-in person may open. Admins always have every tool. */
export function accessFor(role: UserRole | string | null | undefined, permissions: unknown): PermissionKey[] {
  if (role === 'admin') return [...STORE_KEYS, 'staff.manage'];
  if (role !== 'staff') return [];
  const saved = cleanStaffPermissions(permissions);
  // Staff created before permissions existed keep the store tools until an admin limits them.
  if (saved.length === 0) return [...STORE_KEYS];
  return saved;
}

export function can(user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined, permission: PermissionKey) {
  if (!user) return false;
  return accessFor(user.role, user.permissions).includes(permission);
}

export function canAny(
  user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined,
  permissions: PermissionKey[]
) {
  return permissions.some((permission) => can(user, permission));
}

export function presetFor(permissions: string[]) {
  const saved = [...permissions].sort().join(',');
  return PRESETS.find((preset) => [...preset.permissions].sort().join(',') === saved) || null;
}

export const ADMIN_PAGE_ACCESS: { prefix: string; permission: PermissionKey }[] = [
  { prefix: '/admin/staff', permission: 'staff.manage' },
  { prefix: '/admin/activity', permission: 'staff.manage' },
  { prefix: '/admin/orders', permission: 'orders.view' },
  { prefix: '/admin/payments', permission: 'payments.view' },
  { prefix: '/admin/pos', permission: 'pos.use' },
  { prefix: '/admin/end-of-day', permission: 'end_of_day' },
  { prefix: '/admin/products', permission: 'products.manage' },
  { prefix: '/admin/sales', permission: 'sales.manage' },
  { prefix: '/admin/categories', permission: 'categories.manage' },
  { prefix: '/admin/customers', permission: 'customers.view' },
  { prefix: '/admin/reviews', permission: 'reviews.manage' },
  { prefix: '/admin/inventory', permission: 'inventory.manage' },
  { prefix: '/admin/analytics', permission: 'analytics.view' },
  { prefix: '/admin/coupons', permission: 'coupons.manage' },
  { prefix: '/admin/customer-insights', permission: 'customers.view' },
  { prefix: '/admin/notifications', permission: 'notifications.send' },
  { prefix: '/admin/test-sms', permission: 'notifications.send' },
  { prefix: '/admin/blog', permission: 'blog.manage' },
  { prefix: '/admin/modules', permission: 'settings.manage' },
];

export function permissionForPath(pathname: string): PermissionKey | null {
  const match = ADMIN_PAGE_ACCESS.find(
    (page) => pathname === page.prefix || pathname.startsWith(`${page.prefix}/`)
  );
  return match?.permission ?? null;
}
