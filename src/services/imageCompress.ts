// Browser-side image preparation for uploads (package photos, payment proofs; docs/update.md §3).
// Resizes to at most 1600px on the longest side and re-encodes as WebP (JPEG where the browser
// can't encode WebP). Redrawing on a canvas keeps only the pixels, so EXIF metadata, including
// GPS location, is dropped. The server still checks every upload itself (server/uploads.ts).

export interface CompressedImage {
  /** Base64 without the `data:` prefix. */
  base64: string;
  mimeType: 'image/webp' | 'image/jpeg';
  width: number;
  height: number;
  sizeBytes: number;
}

export interface CompressOptions {
  maxSide?: number;
  /** Matches the server cap (MAX_UPLOAD_BYTES in server/uploads.ts). */
  maxBytes?: number;
}

const DEFAULT_MAX_SIDE = 1600;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
// Tried in order until the result fits under maxBytes.
const QUALITIES = [0.82, 0.72, 0.6, 0.5];

export class ImageCompressError extends Error {}

// Some browsers report HEIC/HEIF photos with an empty type, so the extension is checked too.
function looksLikeImage(file: Blob): boolean {
  if (file.type.startsWith('image/')) return true;
  const name = (file as File).name || '';
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(name);
}

async function loadImage(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  // createImageBitmap applies the EXIF orientation, so phone photos aren't drawn sideways.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through: some browsers decode formats (e.g. HEIC in Safari) only via <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } catch {
    throw new ImageCompressError('This image format isn’t supported by your browser. Please use a JPG, PNG or WebP image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new ImageCompressError('The image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

/** Resizes and re-encodes an image file for upload. Throws ImageCompressError with a user-facing message. */
export async function compressImage(file: Blob, options: CompressOptions = {}): Promise<CompressedImage> {
  const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!looksLikeImage(file)) {
    throw new ImageCompressError('Please choose an image file (JPG, PNG, WebP or HEIC).');
  }

  const source = await loadImage(file);
  if (!source.width || !source.height) throw new ImageCompressError('The image could not be read.');
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageCompressError('The image could not be processed in this browser.');

  const draw = (opaque: boolean) => {
    ctx.clearRect(0, 0, width, height);
    // JPEG has no transparency; white keeps transparent PNG areas from turning black.
    if (opaque) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
  };

  try {
    // Browsers that can't encode WebP silently return PNG from toBlob, so check the result type.
    draw(false);
    let mimeType: CompressedImage['mimeType'] = 'image/webp';
    const probe = await canvasToBlob(canvas, 'image/webp', QUALITIES[0]);
    if (!probe || probe.type !== 'image/webp') {
      mimeType = 'image/jpeg';
      draw(true);
    }

    let blob: Blob | null = mimeType === 'image/webp' ? probe : null;
    for (const quality of QUALITIES) {
      if (!blob || quality !== QUALITIES[0]) blob = await canvasToBlob(canvas, mimeType, quality);
      if (blob && blob.size <= maxBytes) break;
    }
    if (!blob) throw new ImageCompressError('The image could not be processed in this browser.');
    if (blob.size > maxBytes) throw new ImageCompressError('The image is too large, even after compression.');

    return { base64: await blobToBase64(blob), mimeType, width, height, sizeBytes: blob.size };
  } finally {
    if ('close' in source && typeof source.close === 'function') source.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
