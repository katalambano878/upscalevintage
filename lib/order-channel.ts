export type OrderChannel = 'online' | 'pos';

type ChannelOrder = {
  channel?: string | null;
  email?: string | null;
  metadata?: {
    pos_sale?: unknown;
    channel?: unknown;
    tracking_number?: unknown;
  } | null;
};

export function orderChannel(order: ChannelOrder): OrderChannel {
  if (order.channel === 'pos' || order.channel === 'online') return order.channel;

  const meta = order.metadata || {};
  if (meta.pos_sale === true || meta.pos_sale === 'true' || meta.channel === 'pos') return 'pos';

  const email = (order.email || '').toLowerCase();
  if (email.endsWith('@pos.local') || email === 'pos-walkin@store.local') return 'pos';
  if (String(meta.tracking_number || '').startsWith('SLI-POS-')) return 'pos';

  return 'online';
}

export function orderChannelLabel(channel: OrderChannel) {
  return channel === 'pos' ? 'In store' : 'Online';
}
