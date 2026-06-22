import { parsePuzzleFromLocation } from './codec.js';
import { initCreateMode } from './create.js';
import { initSolveMode } from './solve.js';

const modeNav = document.getElementById('modeNav');
const createPanel = document.getElementById('createPanel');
const solvePanel = document.getElementById('solvePanel');

const urlPuzzle = parsePuzzleFromLocation();
let currentMode = urlPuzzle ? 'solve' : 'create';

initCreateMode();
const solveApi = initSolveMode(urlPuzzle);

if (urlPuzzle) {
  if (urlPuzzle.mediaRef && !urlPuzzle.secretMedia) {
    alert('此链接使用了本机存储方案，无法加载照片/视频密语。请让创作者重新生成「标准分享」链接。');
  }
  setMode('solve');
  modeNav.querySelector('[data-mode="solve"]').classList.add('active');
  modeNav.querySelector('[data-mode="create"]').classList.remove('active');
}

modeNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  setMode(btn.dataset.mode);
  modeNav.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
});

function setMode(mode) {
  currentMode = mode;
  createPanel.classList.toggle('hidden', mode !== 'create');
  solvePanel.classList.toggle('hidden', mode !== 'solve');
}

export { currentMode };
