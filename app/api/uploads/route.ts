import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { noteAction } from '@/lib/audit';
import { allow } from '@/lib/staff-gate';
import { compressImageBuffer } from '@/lib/image-compress';

export const runtime = 'nodejs';

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * The real image type from the file's first bytes. The browser-supplied type
 * and filename can say anything; SVG is refused because an SVG can carry
 * script that would run on this site's origin.
 */
function sniffImage(buf: Buffer): { contentType: string; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: 'image/jpeg', ext: '.jpg' };
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: 'image/png', ext: '.png' };
  }
  if (buf.length >= 6 && (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a')) {
    return { contentType: 'image/gif', ext: '.gif' };
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { contentType: 'image/webp', ext: '.webp' };
  }
  return null;
}

function uploadRoot() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

function publicBase() {
  const base =
    process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ||
    `${(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')}/uploads`;
  return base.replace(/\/+$/, '');
}

export async function POST(request: Request) {
  const gate = await allow(request, ['products.manage', 'categories.manage', 'blog.manage']);
  if (gate.denied) return gate.denied;

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const blob = file as File;
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 12MB)' }, { status: 400 });
    }

    const raw = Buffer.from(await blob.arrayBuffer());
    const sniffed = sniffImage(raw);
    if (!sniffed || !ALLOWED.has(sniffed.contentType)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, WebP or GIF images can be uploaded.' },
        { status: 400 }
      );
    }

    const compressed = await compressImageBuffer(raw, sniffed.contentType);
    const buffer = Buffer.from(compressed.buffer);
    const finalType = sniffImage(buffer) || sniffed;
    const contentType = finalType.contentType;

    const folder = String(form.get('folder') || 'products').replace(/[^a-z0-9_-]/gi, '') || 'products';
    const ext = finalType.ext;
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const relative = path.posix.join(folder, filename);
    const absDir = path.join(uploadRoot(), folder);
    const absPath = path.join(uploadRoot(), folder, filename);

    await mkdir(absDir, { recursive: true });
    await writeFile(absPath, buffer);

    const url = `${publicBase()}/${relative}`;
    return NextResponse.json({
      url,
      path: `/${relative}`,
      contentType,
      size: buffer.length,
    });
  } catch (err: unknown) {
    console.error('[uploads POST]', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
