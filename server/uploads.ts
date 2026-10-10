import path from 'path';
import fs from 'fs';

// Uploaded files (package images, payment-proof screenshots) live on disk, not in SQLite
// (docs/update.md §3). UPLOADS_DIR must be a persistent folder OUTSIDE the deploy directory,
// for the same reason as DB_PATH (see server/db.ts): a git-based redeploy wipes untracked
// files. When unset it sits next to the database: data/uploads in dev, or beside DB_PATH.
// Computed here rather than imported from db.ts so this module has no side effects on import.
export const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR
    || path.join(process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(process.cwd(), 'data'), 'uploads')
);

export type UploadFolder = 'images' | 'proofs';

// images/: package photos, served publicly via /media when marked visible.
// proofs/: payment screenshots, private, only ever served through an admin-only route.
export const uploadFolders: Record<UploadFolder, string> = {
  images: path.join(uploadsDir, 'images'),
  proofs: path.join(uploadsDir, 'proofs'),
};

export function ensureUploadDirs() {
  for (const dir of Object.values(uploadFolders)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
