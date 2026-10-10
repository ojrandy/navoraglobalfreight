// Tests for the server upload helper (docs/update.md A.2): content checks, size cap, safe names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Point UPLOADS_DIR at a throwaway folder before the module reads it.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ngf-uploads-'));
process.env.UPLOADS_DIR = tmp;
const { detectImageType, decodeImageUpload, saveImageUpload, resolveUploadPath, deleteUpload, uploadFolders, ensureUploadDirs } =
  await import('../server/uploads.ts');
ensureUploadDirs();

const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

test('uploads: images are identified by content, not by name or declared type', () => {
  assert.equal(detectImageType(WEBP), 'webp');
  assert.equal(detectImageType(JPEG), 'jpeg');
  assert.equal(detectImageType(PNG), 'png');
  assert.equal(detectImageType(Buffer.from('GIF89a......')), null);
  assert.equal(detectImageType(Buffer.from('%PDF-1.7 ....')), null);
  assert.equal(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(detectImageType(Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20])), null); // RIFF AVI
  assert.equal(detectImageType(Buffer.alloc(0)), null);
});

test('uploads: decode accepts base64 and data URLs, rejects everything else', () => {
  const asDataUrl = `data:image/png;base64,${WEBP.toString('base64')}`; // declared type is ignored
  const fromUrl = decodeImageUpload(asDataUrl);
  assert.ok(fromUrl.ok && fromUrl.type === 'webp');
  const plain = decodeImageUpload(JPEG.toString('base64'));
  assert.ok(plain.ok && plain.type === 'jpeg');

  for (const bad of [undefined, null, 42, '', 'data:image/webp;base64,', 'not base64!!', '../../etc/passwd']) {
    assert.equal(decodeImageUpload(bad).ok, false, String(bad));
  }
  const pdf = decodeImageUpload(Buffer.from('%PDF-1.7 fake').toString('base64'));
  assert.ok(!pdf.ok && /JPG, PNG or WebP/.test(pdf.error));
});

test('uploads: size cap applies before and after decoding', () => {
  const big = Buffer.concat([PNG, Buffer.alloc(3000)]);
  const res = decodeImageUpload(big.toString('base64'), 2000);
  assert.ok(!res.ok && /too large/.test(res.error));
  assert.ok(decodeImageUpload(big.toString('base64'), 4000).ok);
});

test('uploads: saved under a random name in the right folder; foreign names are refused', () => {
  const saved = saveImageUpload('proofs', `data:image/webp;base64,${WEBP.toString('base64')}`);
  assert.ok(saved.ok);
  if (!saved.ok) return;
  assert.match(saved.fileName, /^[0-9a-f-]{36}\.webp$/);
  assert.equal(saved.fileName, `${saved.id}.webp`);
  const filePath = resolveUploadPath('proofs', saved.fileName);
  assert.equal(filePath, path.join(uploadFolders.proofs, saved.fileName));
  assert.ok(filePath && fs.existsSync(filePath));
  assert.deepEqual(fs.readFileSync(filePath!), WEBP);

  for (const evil of ['../navora.db', '..\navora.db', 'x.webp', `${saved.id}.svg`, `../images/${saved.fileName}`, '']) {
    assert.equal(resolveUploadPath('images', evil), null, evil);
  }
  deleteUpload('proofs', '../../navora.db'); // ignored, never resolved
  deleteUpload('proofs', saved.fileName);
  assert.equal(fs.existsSync(filePath!), false);
  deleteUpload('proofs', saved.fileName); // already gone: no throw

  assert.equal(saveImageUpload('images', Buffer.from('hello').toString('base64')).ok, false);
  assert.deepEqual(fs.readdirSync(uploadFolders.images), []);
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
