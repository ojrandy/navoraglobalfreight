// Tests for the read-only older photos filter (docs/update.md B.7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyPhotoUrls } from '../src/shared/legacyPhotos.ts';

test('legacy photos: keeps image addresses, drops anything else', () => {
  assert.deepEqual(legacyPhotoUrls(undefined), []);
  assert.deepEqual(legacyPhotoUrls('https://example.com/a.jpg'), []);
  assert.deepEqual(legacyPhotoUrls([
    'https://cdn.example.com/a.jpg', ' /images/b.webp ', 'data:image/png;base64,iVBORw0K',
    'javascript:alert(1)', '//evil.example/x.png', 'data:text/html;base64,PHNjcmlwdD4=', 42, null, '',
  ]), ['https://cdn.example.com/a.jpg', '/images/b.webp', 'data:image/png;base64,iVBORw0K']);
});
