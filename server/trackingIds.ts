import { randomInt } from 'node:crypto';
import { db } from './db.js';
import { generateTrackingId } from '../src/shared/trackingId.js';

// The server is the authority on tracking IDs (BRAND_GUIDE §7): a fresh ID is only handed out
// once it is confirmed unused, including by shipments sitting in the trash. Randomness comes
// from crypto.randomInt, as §7 specifies for the server.
export function generateUniqueTrackingId(): string {
  const exists = db.prepare('SELECT 1 FROM shipments WHERE tracking_number = ?');
  // 32^5 = 33.5 million IDs, so a collision is rare and a second one in a row rarer still.
  for (let attempt = 0; attempt < 20; attempt++) {
    const id = generateTrackingId((max) => randomInt(max));
    if (!exists.get(id)) return id;
  }
  throw new Error('Could not allocate a unique tracking ID.');
}
