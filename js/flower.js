import { getColor, getEmoji, rotationIndexToDeg } from './constants.js';

function hashSeed(emojiIndex, rotation, colorIndex) {
  const str = `${emojiIndex}|${rotation}|${colorIndex}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(hash, min, max) {
  return min + (hash % (max - min + 1));
}

function hslShift(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.max(0, r + amount));
  const ng = Math.min(255, Math.max(0, g + amount * 0.6));
  const nb = Math.min(255, Math.max(0, b + amount * 0.3));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function petalPath(cx, cy, innerR, outerR, angle, roundness) {
  const tipX = cx + Math.cos(angle) * outerR;
  const tipY = cy + Math.sin(angle) * outerR;
  const leftAngle = angle - Math.PI / pick(Math.abs(Math.sin(angle * 100)), 8, 12) * roundness;
  const rightAngle = angle + Math.PI / pick(Math.abs(Math.cos(angle * 100)), 8, 12) * roundness;
  const leftX = cx + Math.cos(leftAngle) * innerR;
  const leftY = cy + Math.sin(leftAngle) * innerR;
  const rightX = cx + Math.cos(rightAngle) * innerR;
  const rightY = cy + Math.sin(rightAngle) * innerR;
  const cp1x = cx + Math.cos(angle - 0.35) * (innerR + outerR) * 0.45;
  const cp1y = cy + Math.sin(angle - 0.35) * (innerR + outerR) * 0.45;
  const cp2x = cx + Math.cos(angle + 0.35) * (innerR + outerR) * 0.45;
  const cp2y = cy + Math.sin(angle + 0.35) * (innerR + outerR) * 0.45;
  return `M ${leftX} ${leftY} Q ${cp1x} ${cp1y} ${tipX} ${tipY} Q ${cp2x} ${cp2y} ${rightX} ${rightY} Z`;
}

export function generateFlowerSvg(cell, options = {}) {
  const { size = 80, showEmoji = true, className = '', bloom = false } = options;
  if (cell.e < 0) {
    return `<svg viewBox="0 0 80 80" width="${size}" height="${size}" class="flower-svg empty ${className}" aria-hidden="true">
      <circle cx="40" cy="40" r="28" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 4"/>
    </svg>`;
  }

  const seed = hashSeed(cell.e, cell.r, cell.c);
  const base = getColor(cell.c);
  const petalCount = pick(seed, 5, 11);
  const innerR = pick(seed >> 3, 10, 16);
  const outerR = pick(seed >> 5, 24, 34);
  const roundness = pick(seed >> 7, 10, 14) / 10;
  const rotOffset = rotationIndexToDeg(cell.r) + pick(seed >> 9, 0, 359);
  const petalColor = base.hex;
  const petalLight = hslShift(base.light, pick(seed >> 11, -10, 18));
  const centerColor = hslShift(base.hex, -25);
  const uid = `f${seed.toString(16)}`;

  let petals = '';
  for (let i = 0; i < petalCount; i++) {
    const angle = (Math.PI * 2 * i) / petalCount + (rotOffset * Math.PI) / 180;
    const d = petalPath(40, 40, innerR, outerR, angle, roundness);
    petals += `<path d="${d}" fill="url(#grad-${uid})" opacity="${0.85 + (i % 3) * 0.05}"/>`;
  }

  const stem = pick(seed >> 13, 0, 1)
    ? `<line x1="40" y1="52" x2="40" y2="72" stroke="${hslShift(base.hex, -35)}" stroke-width="2.5" stroke-linecap="round"/>`
    : '';

  const emoji = showEmoji ? getEmoji(cell.e) : '';
  const emojiEl = emoji
    ? `<text x="40" y="44" text-anchor="middle" dominant-baseline="central" font-size="${pick(seed >> 15, 14, 18)}" class="flower-emoji">${emoji}</text>`
    : '';

  const bloomClass = bloom ? ' blooming' : '';

  return `<svg viewBox="0 0 80 80" width="${size}" height="${size}" class="flower-svg ${className}${bloomClass}" aria-hidden="true">
    <defs>
      <radialGradient id="grad-${uid}" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stop-color="${petalLight}"/>
        <stop offset="100%" stop-color="${petalColor}"/>
      </radialGradient>
    </defs>
    ${stem}
    <g class="petals">${petals}</g>
    <circle cx="40" cy="40" r="${innerR - 2}" fill="${centerColor}" opacity="0.9"/>
    ${emojiEl}
  </svg>`;
}

export function renderGardenGrid(cells, container, options = {}) {
  const {
    onCellClick,
    selectedIndex = -1,
    feedback = null,
    interactive = false,
    showEmoji = true,
    cellSize = 64,
  } = options;

  container.innerHTML = '';
  container.style.setProperty('--cell-size', `${cellSize}px`);

  cells.forEach((cell, index) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'grid-cell';
    el.dataset.index = String(index);
    if (!interactive) el.disabled = true;
    if (index === selectedIndex) el.classList.add('selected');
    if (feedback && feedback[index]) el.classList.add(`fb-${feedback[index]}`);

    el.innerHTML = generateFlowerSvg(cell, { size: cellSize, showEmoji });
    if (interactive && onCellClick) {
      el.addEventListener('click', () => onCellClick(index));
    }
    container.appendChild(el);
  });
}
