// Tracking IDs (BRAND_GUIDE §7): the prefix plus 5 characters, exactly 8 in total,
// e.g. NGF7K2M9. Shared by the browser and the server (tsconfig.server.json compiles it too),
// so every place that creates, validates or looks up an ID follows the same rules.
import { TRACKING_PREFIX } from '../config/brand.js';

// No 0/O or 1/I, so an ID read aloud or off a label can't be misread.
export const TRACKING_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SUFFIX_LENGTH = 5;
const ID_LENGTH = TRACKING_PREFIX.length + SUFFIX_LENGTH;

export const TRACKING_ID_PATTERN = new RegExp(`^${TRACKING_PREFIX}[2-9A-HJ-NP-Z]{${SUFFIX_LENGTH}}$`);
// Multi-piece child label: the parent ID plus a 2-digit piece number, e.g. NGF7K2M9-01.
// The dash is optional so a label typed without it (NGF7K2M901) still resolves.
const PIECE_LABEL_PATTERN = new RegExp(`^(${TRACKING_PREFIX}[2-9A-HJ-NP-Z]{${SUFFIX_LENGTH}})-?(\\d{2})$`);

// Any dash punctuation (hyphen, en/em dash, ...), since IDs get pasted from documents and emails.
const DASHES = /\p{Pd}/gu;

/** Returns a uniformly random integer in [0, max). */
export type RandomIndex = (max: number) => number;

// Browser default: crypto.getRandomValues. The alphabet has exactly 32 characters, so
// `byte & 31` picks each one with equal probability.
const webCryptoIndex: RandomIndex = (max) => {
  const byte = globalThis.crypto.getRandomValues(new Uint8Array(1))[0];
  return byte & (max - 1);
};

// A random ID. The server passes Node's crypto.randomInt (BRAND_GUIDE §7) and is the only
// caller that allocates real IDs: it checks uniqueness and retries (server/trackingIds.ts).
export function generateTrackingId(randomIndex: RandomIndex = webCryptoIndex): string {
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) suffix += TRACKING_ALPHABET[randomIndex(TRACKING_ALPHABET.length)];
  return TRACKING_PREFIX + suffix;
}

// Trims, upper-cases and strips spaces and dashes: "ngf 7k2-m9" -> "NGF7K2M9". A trailing
// piece number on a full 8-character ID keeps its dash: "ngf7k2m9 - 01" -> "NGF7K2M9-01".
export function normalizeTrackingInput(input: string): string {
  const compact = input.trim().toUpperCase().replace(/\s+/g, '').replace(DASHES, '-');
  const piece = /^(.+?)-(\d{2})$/.exec(compact);
  if (piece) {
    const base = piece[1].replace(/-+/g, '');
    if (base.length === ID_LENGTH) return `${base}-${piece[2]}`;
  }
  return compact.replace(/-+/g, '');
}

// Strict check of an already-normalised ID.
export function isValidTrackingId(id: string): boolean {
  return TRACKING_ID_PATTERN.test(id);
}

export interface PieceLabel {
  /** The 8-character shipment ID the label belongs to. */
  parentId: string;
  /** Piece number, from 1. */
  piece: number;
}

// Parses a child label such as NGF7K2M9-01. Input is normalised first; returns null for
// anything that isn't a piece label (including a bare 8-character ID and piece 00).
export function parsePieceLabel(input: string): PieceLabel | null {
  const match = PIECE_LABEL_PATTERN.exec(normalizeTrackingInput(input));
  if (!match) return null;
  const piece = Number(match[2]);
  return piece >= 1 ? { parentId: match[1], piece } : null;
}

export interface ParsedTrackingInput {
  /** The 8-character shipment ID the input resolves to. */
  trackingId: string;
  /** Piece number when the input was a child label such as NGF7K2M9-01. */
  piece?: number;
}

// Resolves free-text input to a shipment ID; a child label resolves to its parent.
// Returns null when the input is not a well-formed tracking ID or piece label.
export function parseTrackingInput(input: string): ParsedTrackingInput | null {
  const clean = normalizeTrackingInput(input);
  if (isValidTrackingId(clean)) return { trackingId: clean };
  const child = parsePieceLabel(clean);
  return child ? { trackingId: child.parentId, piece: child.piece } : null;
}

// Child label for piece `n` of a shipment: NGF7K2M9-01.
export function pieceLabel(trackingId: string, piece: number): string {
  return `${trackingId}-${String(piece).padStart(2, '0')}`;
}
