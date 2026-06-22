export const GRID_SIZE = 5;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const MAX_GUESSES = 3;
export const DRAFT_KEY = 'cipher-garden-draft';
/**
 * WeChat chat paste limit — many apps truncate pasted URLs around 1024–2048 chars.
 * Use QR codes for links longer than this.
 */
export const SHARE_URL_SAFE_LENGTH = 2048;

/** Standard share mode — QR-optimized; fits in scannable QR codes with good photo quality. */
export const SHARE_URL_QR_LENGTH = 12000;

/** HD share mode — maximum quality for QR scan opens; too long for chat paste. */
export const SHARE_URL_HD_LENGTH = 32000;

/** Absolute upper bound for inline URL embedding (browser limits). */
export const MAX_URL_LENGTH = 64000;
export const MEDIA_STORAGE_PREFIX = 'cipher-garden-media-';

export const EMOJIS = [
  '🌸', '🌺', '🌻', '🌷', '🌹',
  '🍀', '🌿', '🪻', '🌼', '💐',
  '🦋', '🐝', '☀️', '🌙', '⭐',
];

export const COLORS = [
  { id: 0, name: '苔绿', hex: '#5a8f6a', light: '#8fbc8f' },
  { id: 1, name: '玫瑰', hex: '#c75b7a', light: '#f4a4b8' },
  { id: 2, name: '薰衣草', hex: '#8b7ec8', light: '#c4b5fd' },
  { id: 3, name: '向日葵', hex: '#e8a838', light: '#fde68a' },
  { id: 4, name: '珊瑚', hex: '#e07a5f', light: '#fca5a4' },
  { id: 5, name: '天青', hex: '#4a90a4', light: '#7dd3fc' },
  { id: 6, name: '薄荷', hex: '#6ebf8b', light: '#a7f3d0' },
  { id: 7, name: '琥珀', hex: '#d4a056', light: '#fcd34d' },
];

export const ROTATIONS = [
  { deg: 0, label: '0°' },
  { deg: 90, label: '90°' },
  { deg: 180, label: '180°' },
  { deg: 270, label: '270°' },
];

export const FEEDBACK = {
  EXACT: 'exact',
  PARTIAL: 'partial',
  PRESENT: 'present',
  ABSENT: 'absent',
};

export function emptyCell() {
  return { e: -1, r: 0, c: 0 };
}

export function emptyGrid() {
  return Array.from({ length: CELL_COUNT }, emptyCell);
}

export function getEmoji(index) {
  return index >= 0 && index < EMOJIS.length ? EMOJIS[index] : '';
}

export function getColor(index) {
  return COLORS[index] ?? COLORS[0];
}

export function rotationIndexToDeg(index) {
  return ROTATIONS[index]?.deg ?? 0;
}

export function cellKey(cell) {
  return `${cell.e}:${cell.r}:${cell.c}`;
}

export function isPlanted(cell) {
  return cell.e >= 0;
}
