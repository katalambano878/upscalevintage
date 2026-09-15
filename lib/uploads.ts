import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import sharp from 'sharp';
import { ApiError } from './api';

export const UPLOAD_BUCKETS = ['products', 'avatars', 'blog', 'media', 'reviews'] as const;
export type UploadBucket = (typeof UPLOAD_BUCKETS)[number];

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED = new Map<string, { ext: string; mime: string }>([
    ['jpeg', { ext: 'jpg', mime: 'image/jpeg' }],
    ['png', { ext: 'png', mime: 'image/png' }],
    ['webp', { ext: 'webp', mime: 'image/webp' }],
    ['avif', { ext: 'avif', mime: 'image/avif' }],
    ['gif', { ext: 'gif', mime: 'image/gif' }],
]);

export function uploadRoot(): string {
    return process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads');
}

export interface StoredUpload {
    url: string;
    path: string;
    width: number | null;
    height: number | null;
    bytes: number;
}

export async function storeUpload(file: File, bucket: UploadBucket): Promise<StoredUpload> {
    if (!UPLOAD_BUCKETS.includes(bucket)) {
        throw new ApiError('Unknown upload destination.', 400, 'invalid_bucket');
    }

    if (file.size === 0) {
        throw new ApiError('The file is empty.', 422, 'empty_file');
    }

    if (file.size > MAX_BYTES) {
        throw new ApiError(
            `Images must be ${Math.floor(MAX_BYTES / 1024 / 1024)}MB or smaller.`,
            413,
            'file_too_large'
        );
    }

    const input = Buffer.from(await file.arrayBuffer());

    let metadata: sharp.Metadata;
    try {
        metadata = await sharp(input).metadata();
    } catch {
        throw new ApiError('That file is not a readable image.', 422, 'invalid_image');
    }

    const allowed = metadata.format ? ALLOWED.get(metadata.format) : undefined;
    if (!allowed) {
        throw new ApiError('Only JPEG, PNG, WebP, AVIF and GIF images are allowed.', 422, 'unsupported_format');
    }

    const shouldConvert = metadata.format !== 'gif';
    const output = shouldConvert
        ? await sharp(input).rotate().webp({ quality: 82 }).toBuffer()
        : input;
    const extension = shouldConvert ? 'webp' : allowed.ext;

    const name = `${Date.now()}-${randomUUID()}.${extension}`;
    const directory = join(uploadRoot(), bucket);

    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, name), output);

    return {
        url: `/uploads/${bucket}/${name}`,
        path: `${bucket}/${name}`,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        bytes: output.length,
    };
}

export async function deleteUpload(urlOrPath: string): Promise<boolean> {
    const relative = urlOrPath.replace(/^\/uploads\//, '').replace(/^\/+/, '');
    const [bucket, ...rest] = relative.split('/');

    if (!bucket || rest.length === 0) return false;
    if (!UPLOAD_BUCKETS.includes(bucket as UploadBucket)) return false;

    const root = uploadRoot();
    const target = normalize(join(root, bucket, ...rest));

    if (!target.startsWith(normalize(root) + sep)) return false;

    try {
        await unlink(target);
        return true;
    } catch {
        return false;
    }
}
