// Older shipments may carry photo URLs in shipments.photos_json (docs/update.md B.7). They are
// shown read-only next to the captioned package images. Only values that look like an image
// address are kept, so a stray or malformed entry can't become an arbitrary src.
const SAFE_PHOTO = /^(https?:\/\/|\/(?!\/)|data:image\/(png|jpe?g|webp|gif|avif);base64,)/i;

export function legacyPhotoUrls(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];
  return photos.filter((p): p is string => typeof p === 'string' && SAFE_PHOTO.test(p.trim())).map((p) => p.trim());
}
