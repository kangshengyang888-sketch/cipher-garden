import { CELL_COUNT, emptyGrid } from './constants.js';
import { getPublicBaseUrl } from './config.js';
import {
  compactSecretMedia,
  hashPuzzleId,
  loadMediaRef,
  normalizeSecretMedia,
  restoreDataUrlFromRaw,
  storeMediaRef,
  stripDataUrlPrefix,
} from './media.js';

const VERSION_V1 = 1;
const VERSION_V2 = 2;

function normalizeCells(cells) {
  const grid = emptyGrid();
  for (let i = 0; i < CELL_COUNT; i++) {
    const src = cells[i];
    if (!src) continue;
    grid[i] = {
      e: Number.isInteger(src.e) ? src.e : -1,
      r: Math.min(3, Math.max(0, src.r ?? 0)),
      c: Math.min(7, Math.max(0, src.c ?? 0)),
    };
  }
  return grid;
}

function normalizeCellsV2(cells) {
  const grid = emptyGrid();
  for (let i = 0; i < CELL_COUNT; i++) {
    const src = cells[i];
    if (!src || !Array.isArray(src)) continue;
    grid[i] = {
      e: Number.isInteger(src[0]) ? src[0] : -1,
      r: Math.min(3, Math.max(0, src[1] ?? 0)),
      c: Math.min(7, Math.max(0, src[2] ?? 0)),
    };
  }
  return grid;
}

function buildPayloadV1(cells, message, secretMedia, mediaRef) {
  const payload = {
    v: VERSION_V1,
    cells: cells.map(({ e, r, c }) => ({ e, r, c })),
    msg: String(message || '').slice(0, 120),
  };
  if (mediaRef) {
    payload.mref = mediaRef;
  } else if (secretMedia) {
    payload.media = compactSecretMedia(secretMedia);
  }
  return payload;
}

function buildPayloadV2(cells, message, secretMedia, externalPhotoUrl) {
  const payload = {
    v: VERSION_V2,
    c: cells.map(({ e, r, c }) => [e, r, c]),
    m: String(message || '').slice(0, 120),
  };
  if (externalPhotoUrl) {
    payload.u = externalPhotoUrl;
  } else if (secretMedia) {
    const normalized = normalizeSecretMedia(secretMedia);
    payload.t = normalized.type === 'video' ? 'v' : 'p';
    payload.p = stripDataUrlPrefix(normalized.data);
  }
  return payload;
}

function isV2Payload(data) {
  return data.v === VERSION_V2 || (Array.isArray(data.c) && !Array.isArray(data.cells));
}

function parseSecretMediaFromPayload(data) {
  if (data.u) {
    return normalizeSecretMedia({ type: 'photo', data: data.u, external: true });
  }
  if (data.p) {
    return normalizeSecretMedia({
      t: data.t || 'p',
      d: restoreDataUrlFromRaw(data.p, data.t || 'p'),
    });
  }
  if (data.media) {
    return normalizeSecretMedia(data.media);
  }
  if (data.mref) {
    return loadMediaRef(data.mref);
  }
  return null;
}

export function normalizeEncodedParam(encoded) {
  if (!encoded) return null;
  return String(encoded).trim().replace(/\s+/g, '');
}

export function isLocalOrigin() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function encodePuzzle(cells, message = '', secretMedia = null, options = {}) {
  const { forceMediaRef = false, externalPhotoUrl = null } = options;
  const normalized = secretMedia ? normalizeSecretMedia(secretMedia) : null;

  if (!forceMediaRef) {
    const inline = buildPayloadV2(cells, message, externalPhotoUrl ? null : normalized, externalPhotoUrl);
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(inline));
    return {
      encoded,
      mediaRef: null,
      usedRef: false,
      externalPhoto: !!externalPhotoUrl,
    };
  }

  const ref = hashPuzzleId(cells, message);
  if (normalized) {
    storeMediaRef(ref, normalized);
  }
  const refPayload = buildPayloadV1(cells, message, null, normalized ? ref : null);
  const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(refPayload));
  return {
    encoded,
    mediaRef: normalized ? ref : null,
    usedRef: !!normalized,
    externalPhoto: false,
  };
}

export function decodePuzzle(encoded) {
  const cleaned = normalizeEncodedParam(encoded);
  if (!cleaned) return null;

  const attempts = [cleaned];
  try {
    const decoded = decodeURIComponent(cleaned);
    if (decoded !== cleaned) attempts.push(decoded);
  } catch {
    /* ignore malformed escape sequences */
  }

  for (const candidate of attempts) {
    try {
      const json = LZString.decompressFromEncodedURIComponent(candidate);
      if (!json) continue;
      const data = JSON.parse(json);
      if (!data) continue;

      if (isV2Payload(data)) {
        if (!Array.isArray(data.c)) continue;
        const secretMedia = parseSecretMediaFromPayload(data);
        return {
          cells: normalizeCellsV2(data.c),
          message: String(data.m || ''),
          secretMedia,
          mediaRef: null,
          externalPhotoUrl: data.u || null,
        };
      }

      if (!Array.isArray(data.cells)) continue;
      const secretMedia = parseSecretMediaFromPayload(data);
      return {
        cells: normalizeCells(data.cells),
        message: String(data.msg || ''),
        secretMedia,
        mediaRef: data.mref || null,
        externalPhotoUrl: null,
      };
    } catch {
      /* try next candidate */
    }
  }

  return null;
}

export function buildShareUrl(encoded, options = {}) {
  const { useHash = true } = options;
  const base = getPublicBaseUrl();
  if (useHash) {
    return `${base}#puzzle=${encoded}`;
  }
  return `${base}?puzzle=${encoded}`;
}

function extractEncodedFromHash(hash) {
  if (!hash) return null;
  if (hash.startsWith('#puzzle=')) return hash.slice(8);
  if (hash.startsWith('#p=')) return hash.slice(3);
  return null;
}

export function parsePuzzleFromLocation() {
  let encoded = extractEncodedFromHash(window.location.hash);
  if (!encoded) {
    const params = new URLSearchParams(window.location.search);
    encoded = params.get('puzzle');
  }
  if (!encoded) return null;
  return decodePuzzle(encoded);
}

export function extractEncodedFromUrl(url) {
  if (!url) return null;
  const trimmed = String(url).trim();

  try {
    const parsed = new URL(trimmed, window.location.origin);
    let encoded = parsed.searchParams.get('puzzle');
    if (!encoded) encoded = extractEncodedFromHash(parsed.hash);
    if (encoded) return encoded;
  } catch {
    /* fall through to regex */
  }

  const match = trimmed.match(/(?:[#?&](?:puzzle|p)=)([^&#\s]+)/i);
  return match ? match[1] : null;
}
