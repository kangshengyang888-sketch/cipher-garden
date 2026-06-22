import { emptyCell, emptyGrid, getColor, getEmoji, isPlanted, rotationIndexToDeg } from './constants.js';
import { decodePuzzle, extractEncodedFromUrl } from './codec.js';
import { generateFlowerSvg, renderGardenGrid } from './flower.js';
import { resolveSecretMedia } from './media.js';
import {
  MAX_GUESSES,
  cloneGrid,
  evaluateGuess,
  isFullyCorrect,
} from './puzzle.js';
import { buildColorPalette, buildEmojiPalette, buildRotationPicker } from './create.js';

export function initSolveMode(initialPuzzle) {
  const els = {
    loadPrompt: document.getElementById('solveLoadPrompt'),
    solveGame: document.getElementById('solveGame'),
    puzzleUrlInput: document.getElementById('puzzleUrlInput'),
    loadPuzzleBtn: document.getElementById('loadPuzzleBtn'),
    targetGarden: document.getElementById('targetGarden'),
    guessGrid: document.getElementById('guessGrid'),
    submitGuessBtn: document.getElementById('submitGuessBtn'),
    attemptsLeft: document.getElementById('attemptsLeft'),
    guessHistory: document.getElementById('guessHistory'),
    guessHistoryList: document.getElementById('guessHistoryList'),
    solveEmojiPalette: document.getElementById('solveEmojiPalette'),
    solveRotationPicker: document.getElementById('solveRotationPicker'),
    solveColorPalette: document.getElementById('solveColorPalette'),
    bloomOverlay: document.getElementById('bloomOverlay'),
    bloomFlower: document.getElementById('bloomFlower'),
    revealedMediaWrap: document.getElementById('revealedMediaWrap'),
    revealedPhoto: document.getElementById('revealedPhoto'),
    revealedVideo: document.getElementById('revealedVideo'),
    revealedMediaLoading: document.getElementById('revealedMediaLoading'),
    revealedMessage: document.getElementById('revealedMessage'),
    closeBloomBtn: document.getElementById('closeBloomBtn'),
  };

  let puzzle = null;
  let guess = emptyGrid();
  let selectedIndex = 0;
  let tool = { e: 0, r: 0, c: 0 };
  let attemptsLeft = MAX_GUESSES;
  let gameOver = false;

  buildEmojiPalette(els.solveEmojiPalette, tool.e, (idx) => { tool.e = idx; applyToolToCell(); });
  buildRotationPicker(els.solveRotationPicker, tool.r, (idx) => { tool.r = idx; applyToolToCell(); });
  buildColorPalette(els.solveColorPalette, tool.c, (idx) => { tool.c = idx; applyToolToCell(); });

  els.loadPuzzleBtn.addEventListener('click', () => {
    const url = els.puzzleUrlInput.value.trim();
    if (!url) return;
    const encoded = extractEncodedFromUrl(url);
    const loaded = decodePuzzle(encoded);
    if (!loaded) {
      alert('无法解析谜题链接。请检查链接是否完整（微信可能截断过长链接），或请创作者重新生成标准分享链接。');
      return;
    }
    if (loaded.mediaRef && !loaded.secretMedia) {
      alert('此链接使用了本机存储方案，无法在其他设备上加载照片/视频。请让创作者重新生成「标准分享」链接。');
      return;
    }
    startGame(loaded);
  });

  els.submitGuessBtn.addEventListener('click', submitGuess);
  els.closeBloomBtn.addEventListener('click', () => {
    els.bloomOverlay.classList.add('hidden');
    els.bloomOverlay.classList.remove('active');
    els.revealedVideo.pause();
    els.revealedVideo.src = '';
  });

  function applyToolToCell() {
    if (gameOver) return;
    guess[selectedIndex] = { ...tool };
    renderGuessGrid();
  }

  function renderGuessGrid() {
    renderGardenGrid(guess, els.guessGrid, {
      selectedIndex,
      interactive: !gameOver,
      showEmoji: true,
      cellSize: 64,
      onCellClick: (index) => {
        selectedIndex = index;
        const cell = guess[index];
        if (isPlanted(cell)) {
          tool = { e: cell.e, r: cell.r, c: cell.c };
        }
        renderGuessGrid();
      },
    });
  }

  function renderTarget() {
    els.targetGarden.innerHTML = puzzle.cells
      .map((cell) => generateFlowerSvg(cell, { size: 48, showEmoji: false }))
      .join('');
  }

  function startGame(loaded) {
    puzzle = loaded;
    guess = emptyGrid();
    selectedIndex = 0;
    tool = { e: 0, r: 0, c: 0 };
    attemptsLeft = MAX_GUESSES;
    gameOver = false;

    els.loadPrompt.classList.add('hidden');
    els.solveGame.classList.remove('hidden');
    els.guessHistory.classList.add('hidden');
    els.guessHistoryList.innerHTML = '';
    els.attemptsLeft.textContent = String(attemptsLeft);
    els.submitGuessBtn.disabled = false;

    renderTarget();
    renderGuessGrid();
  }

  function submitGuess() {
    if (gameOver || !puzzle) return;
    if (!isGuessComplete(guess, puzzle.cells)) {
      alert('请为每个有花的格子填写猜测，空白格保持空白');
      return;
    }

    const feedback = evaluateGuess(guess, puzzle.cells);
    addHistoryEntry(cloneGrid(guess), feedback);
    els.guessHistory.classList.remove('hidden');

    if (isFullyCorrect(feedback)) {
      winGame(els);
      return;
    }

    attemptsLeft -= 1;
    els.attemptsLeft.textContent = String(attemptsLeft);

    if (attemptsLeft <= 0) {
      loseGame();
    }
  }

  function addHistoryEntry(cells, feedback) {
    const row = document.createElement('div');
    row.className = 'history-row';

    const mini = document.createElement('div');
    mini.className = 'history-grid';
    renderGardenGrid(cells, mini, { feedback, showEmoji: true, cellSize: 40 });
    row.appendChild(mini);

    const summary = document.createElement('p');
    summary.className = 'history-summary';
    const exact = feedback.filter((f) => f === 'exact').length;
    summary.textContent = `完全匹配 ${exact} / ${feedback.length}`;
    row.appendChild(summary);

    els.guessHistoryList.prepend(row);
  }

  function winGame(elsRef = els) {
    gameOver = true;
    elsRef.submitGuessBtn.disabled = true;

    const secretMedia = resolveSecretMedia(puzzle);
    const hasMessage = Boolean(puzzle.message?.trim());
    const defaultMsg = '（创作者没有留下密语，但你看穿了整座花园）';

    elsRef.revealedPhoto.classList.add('hidden');
    elsRef.revealedVideo.classList.add('hidden');
    elsRef.revealedMediaWrap.classList.add('hidden');
    elsRef.revealedMessage.classList.add('hidden');
    elsRef.revealedMediaLoading?.classList.add('hidden');
    elsRef.revealedVideo.pause();
    elsRef.revealedVideo.src = '';

    if (secretMedia) {
      elsRef.revealedMediaWrap.classList.remove('hidden');
      if (secretMedia.type === 'video') {
        elsRef.revealedVideo.src = secretMedia.data;
        elsRef.revealedVideo.classList.remove('hidden');
        elsRef.revealedVideo.play().catch(() => {});
      } else if (secretMedia.external || /^https?:\/\//i.test(secretMedia.data)) {
        elsRef.revealedMediaLoading?.classList.remove('hidden');
        elsRef.revealedPhoto.onload = () => {
          elsRef.revealedMediaLoading?.classList.add('hidden');
        };
        elsRef.revealedPhoto.onerror = () => {
          elsRef.revealedMediaLoading?.classList.add('hidden');
          elsRef.revealedMessage.textContent = '云端照片加载失败，链接可能已过期（24 小时）';
          elsRef.revealedMessage.classList.remove('hidden');
        };
        elsRef.revealedPhoto.src = secretMedia.data;
        elsRef.revealedPhoto.classList.remove('hidden');
      } else {
        elsRef.revealedPhoto.src = secretMedia.data;
        elsRef.revealedPhoto.classList.remove('hidden');
      }
    }

    if (hasMessage) {
      elsRef.revealedMessage.textContent = puzzle.message;
      elsRef.revealedMessage.classList.remove('hidden');
    } else if (puzzle.mediaRef && !secretMedia) {
      elsRef.revealedMessage.textContent =
        '照片/视频密语未能加载（可能使用了本机存储方案，需在创作者设备上打开）';
      elsRef.revealedMessage.classList.remove('hidden');
    } else if (!secretMedia) {
      elsRef.revealedMessage.textContent = defaultMsg;
      elsRef.revealedMessage.classList.remove('hidden');
    }

    elsRef.bloomFlower.innerHTML = puzzle.cells
      .map((cell) => generateFlowerSvg(cell, { size: 56, showEmoji: true, bloom: true }))
      .join('');
    elsRef.bloomOverlay.classList.remove('hidden');
    requestAnimationFrame(() => {
      elsRef.bloomOverlay.classList.add('active');
    });
  }

  function loseGame() {
    gameOver = true;
    els.submitGuessBtn.disabled = true;
    alert('三次机会已用尽。让创作者再给你一次机会吧 🌱');
  }

  if (initialPuzzle) {
    startGame(initialPuzzle);
  }

  return { startGame };
}

function isGuessComplete(guess, target) {
  let hasAny = false;
  for (let i = 0; i < guess.length; i++) {
    if (target[i].e >= 0) {
      if (guess[i].e < 0) return false;
      hasAny = true;
    }
    if (target[i].e < 0 && guess[i].e >= 0) return false;
  }
  return hasAny;
}
