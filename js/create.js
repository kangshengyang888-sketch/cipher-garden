import {
  COLORS,
  DRAFT_KEY,
  EMOJIS,
  ROTATIONS,
  SHARE_URL_HD_LENGTH,
  SHARE_URL_SAFE_LENGTH,
  SHARE_URL_STANDARD_LENGTH,
  emptyCell,
  emptyGrid,
  getColor,
  getEmoji,
  isPlanted,
  rotationIndexToDeg,
} from './constants.js';
import { isUsingPublicOverride } from './config.js';
import { buildShareUrl, encodePuzzle, isLocalOrigin } from './codec.js';
import { generateFlowerSvg, renderGardenGrid } from './flower.js';
import {
  SECRET_MODES,
  assessUrlLength,
  capturePhotoFromStream,
  compressPhoto,
  compressPhotoForShare,
  estimateDataUrlBytes,
  formatBytes,
  getShareUrlLimit,
  openCamera,
  readFileAsPhoto,
  recordVideoFromStream,
  stopStream,
  uploadPhotoToHost,
  dataUrlToBlob,
} from './media.js';
import { countPlanted } from './puzzle.js';

export function initCreateMode() {
  const state = {
    cells: emptyGrid(),
    selectedIndex: 0,
    tool: { e: 0, r: 0, c: 0 },
    secretMode: SECRET_MODES.TEXT,
    mediaType: 'photo',
    secretMedia: null,
    cameraStream: null,
    cameraUnmirror: false,
    recording: false,
  };

  const els = {
    grid: document.getElementById('createGrid'),
    emojiPalette: document.getElementById('emojiPalette'),
    rotationPicker: document.getElementById('rotationPicker'),
    colorPalette: document.getElementById('colorPalette'),
    cellPreview: document.getElementById('cellPreview'),
    cellPreviewMeta: document.getElementById('cellPreviewMeta'),
    gardenOverview: document.getElementById('gardenOverview'),
    hiddenMessage: document.getElementById('hiddenMessage'),
    secretModeTabs: document.getElementById('secretModeTabs'),
    textSecretPanel: document.getElementById('textSecretPanel'),
    mediaSecretPanel: document.getElementById('mediaSecretPanel'),
    openCameraBtn: document.getElementById('openCameraBtn'),
    cameraArea: document.getElementById('cameraArea'),
    cameraStartArea: document.getElementById('cameraStartArea'),
    cameraPreview: document.getElementById('cameraPreview'),
    capturePhotoBtn: document.getElementById('capturePhotoBtn'),
    captureVideoBtn: document.getElementById('captureVideoBtn'),
    stopCameraBtn: document.getElementById('stopCameraBtn'),
    photoFileInput: document.getElementById('photoFileInput'),
    mediaPreviewArea: document.getElementById('mediaPreviewArea'),
    photoPreview: document.getElementById('photoPreview'),
    videoPreview: document.getElementById('videoPreview'),
    retakeMediaBtn: document.getElementById('retakeMediaBtn'),
    clearMediaBtn: document.getElementById('clearMediaBtn'),
    urlLengthWarning: document.getElementById('urlLengthWarning'),
    compressStatus: document.getElementById('compressStatus'),
    shareModeStandard: document.getElementById('shareModeStandard'),
    shareModeHd: document.getElementById('shareModeHd'),
    localhostWarning: document.getElementById('localhostWarning'),
    shareLengthHint: document.getElementById('shareLengthHint'),
    generateLinkBtn: document.getElementById('generateLinkBtn'),
    shareResult: document.getElementById('shareResult'),
    shareUrl: document.getElementById('shareUrl'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    shareQrWrap: document.getElementById('shareQrWrap'),
    shareQrCanvas: document.getElementById('shareQrCanvas'),
    shareQrError: document.getElementById('shareQrError'),
    copyToast: document.getElementById('copyToast'),
    clearGridBtn: document.getElementById('clearGridBtn'),
    loadDraftBtn: document.getElementById('loadDraftBtn'),
  };

  buildEmojiPalette(els.emojiPalette, state.tool.e, (idx) => {
    state.tool.e = idx;
    paintSelectedCell(state);
    refreshUI(state, els);
  });

  buildRotationPicker(els.rotationPicker, state.tool.r, (idx) => {
    state.tool.r = idx;
    paintSelectedCell(state);
    refreshUI(state, els);
  });

  buildColorPalette(els.colorPalette, state.tool.c, (idx) => {
    state.tool.c = idx;
    paintSelectedCell(state);
    refreshUI(state, els);
  });

  initSecretUI(state, els);

  els.clearGridBtn.addEventListener('click', () => {
    if (!confirm('确定清空整个花圃吗？')) return;
    state.cells = emptyGrid();
    saveDraft(state, els);
    refreshUI(state, els);
  });

  els.loadDraftBtn.addEventListener('click', () => {
    const loaded = loadDraft();
    if (!loaded) {
      alert('没有找到本地草稿');
      return;
    }
    state.cells = loaded.cells;
    els.hiddenMessage.value = loaded.message;
    state.secretMode = loaded.secretMode || SECRET_MODES.TEXT;
    state.secretMedia = loaded.secretMedia || null;
    syncSecretModeUI(state, els);
    showMediaPreview(state, els);
    refreshUI(state, els);
  });

  els.generateLinkBtn.addEventListener('click', () => {
    generateShareLink(state, els);
  });

  els.copyLinkBtn.addEventListener('click', async () => {
    const url = els.shareUrl.value;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      els.shareUrl.select();
      document.execCommand('copy');
    }
    const tooLongForChat = url.length > SHARE_URL_SAFE_LENGTH;
    els.copyToast.textContent = tooLongForChat
      ? `已复制（${url.length} 字符，微信聊天可能截断，请优先用下方二维码分享）`
      : '已复制到剪贴板';
    els.copyToast.classList.remove('hidden');
    setTimeout(() => {
      els.copyToast.classList.add('hidden');
      els.copyToast.textContent = '已复制到剪贴板';
    }, tooLongForChat ? 4000 : 2000);
  });

  els.hiddenMessage.addEventListener('input', () => {
    saveDraft(state, els);
  });

  const draft = loadDraft();
  if (draft) {
    state.cells = draft.cells;
    els.hiddenMessage.value = draft.message;
    state.secretMode = draft.secretMode || SECRET_MODES.TEXT;
    state.secretMedia = draft.secretMedia || null;
    syncSecretModeUI(state, els);
    showMediaPreview(state, els);
  }

  refreshUI(state, els);
  return state;
}

function initSecretUI(state, els) {
  els.secretModeTabs.querySelectorAll('.secret-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.secretMode = tab.dataset.mode;
      els.secretModeTabs.querySelectorAll('.secret-tab').forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
      });
      syncSecretModeUI(state, els);
      saveDraft(state, els);
    });
  });

  els.mediaSecretPanel.querySelectorAll('.media-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mediaType = btn.dataset.type;
      els.mediaSecretPanel.querySelectorAll('.media-type-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      updateCaptureButtons(state, els);
    });
  });

  els.openCameraBtn.addEventListener('click', () => startCamera(state, els));
  els.stopCameraBtn.addEventListener('click', () => stopCamera(state, els));
  els.capturePhotoBtn.addEventListener('click', () => capturePhoto(state, els));
  els.captureVideoBtn.addEventListener('click', () => captureVideo(state, els));
  els.retakeMediaBtn.addEventListener('click', () => {
    clearMedia(state, els);
    startCamera(state, els);
  });
  els.clearMediaBtn.addEventListener('click', () => clearMedia(state, els));

  els.photoFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressStatus(els, '正在读取照片…');
    try {
      const data = await readFileAsPhoto(file, {
        onProgress: (msg) => setCompressStatus(els, msg),
      });
      state.secretMedia = { type: 'photo', data };
      stopCamera(state, els);
      showMediaPreview(state, els);
      saveDraft(state, els);
      els.urlLengthWarning.classList.add('hidden');
      const bytes = estimateDataUrlBytes(data);
      setCompressStatus(els, `已压缩至约 ${formatBytes(bytes)}，生成链接时将自动适配分享大小`);
    } catch (err) {
      setCompressStatus(els, '');
      alert(err.message || '无法读取照片');
    }
    e.target.value = '';
  });
}

function syncSecretModeUI(state, els) {
  const showText = state.secretMode === SECRET_MODES.TEXT || state.secretMode === SECRET_MODES.BOTH;
  const showMedia = state.secretMode === SECRET_MODES.MEDIA || state.secretMode === SECRET_MODES.BOTH;
  els.textSecretPanel.classList.toggle('hidden', !showText);
  els.mediaSecretPanel.classList.toggle('hidden', !showMedia);
  if (!showMedia) stopCamera(state, els);
}

async function startCamera(state, els) {
  try {
    stopCamera(state, els);
    const { stream, unmirror } = await openCamera();
    state.cameraStream = stream;
    state.cameraUnmirror = unmirror;
    els.cameraPreview.srcObject = stream;
    els.cameraPreview.classList.toggle('camera-unmirror', unmirror);
    await els.cameraPreview.play();
    els.cameraStartArea.classList.add('hidden');
    els.cameraArea.classList.remove('hidden');
    updateCaptureButtons(state, els);
  } catch (err) {
    alert(err.message || '无法访问相机，可尝试从相册选择照片');
  }
}

function stopCamera(state, els) {
  stopStream(state.cameraStream);
  state.cameraStream = null;
  state.cameraUnmirror = false;
  state.recording = false;
  els.cameraPreview.srcObject = null;
  els.cameraPreview.classList.remove('camera-unmirror');
  els.cameraArea.classList.add('hidden');
  if (!state.secretMedia) els.cameraStartArea.classList.remove('hidden');
  els.captureVideoBtn.textContent = '开始录制';
  els.captureVideoBtn.disabled = false;
}

function updateCaptureButtons(state, els) {
  const isPhoto = state.mediaType === 'photo';
  els.capturePhotoBtn.classList.toggle('hidden', !isPhoto);
  els.captureVideoBtn.classList.toggle('hidden', isPhoto);
}

async function capturePhoto(state, els) {
  try {
    const raw = capturePhotoFromStream(els.cameraPreview, {
      unmirror: state.cameraUnmirror,
    });
    setCompressStatus(els, '正在压缩…');
    const data = await compressPhoto(raw);
    state.secretMedia = { type: 'photo', data };
    stopCamera(state, els);
    showMediaPreview(state, els);
    saveDraft(state, els);
    els.urlLengthWarning.classList.add('hidden');
    const bytes = estimateDataUrlBytes(data);
    setCompressStatus(els, `已压缩至约 ${formatBytes(bytes)}`);
  } catch (err) {
    setCompressStatus(els, '');
    alert(err.message || '拍照失败');
  }
}

async function captureVideo(state, els) {
  if (!state.cameraStream || state.recording) return;
  state.recording = true;
  els.captureVideoBtn.textContent = '录制中…';
  els.captureVideoBtn.disabled = true;
  try {
    const { dataUrl } = await recordVideoFromStream(state.cameraStream);
    state.secretMedia = { type: 'video', data: dataUrl };
    stopCamera(state, els);
    showMediaPreview(state, els);
    saveDraft(state, els);
    els.urlLengthWarning.classList.add('hidden');
  } catch (err) {
    alert(err.message || '录制失败');
    els.captureVideoBtn.textContent = '开始录制';
    els.captureVideoBtn.disabled = false;
    state.recording = false;
  }
}

function showMediaPreview(state, els) {
  if (!state.secretMedia) {
    els.mediaPreviewArea.classList.add('hidden');
    els.cameraStartArea.classList.remove('hidden');
    return;
  }
  els.mediaPreviewArea.classList.remove('hidden');
  els.cameraStartArea.classList.add('hidden');
  const isPhoto = state.secretMedia.type === 'photo';
  els.photoPreview.classList.toggle('hidden', !isPhoto);
  els.videoPreview.classList.toggle('hidden', isPhoto);
  if (isPhoto) {
    els.photoPreview.src = state.secretMedia.data;
  } else {
    els.videoPreview.src = state.secretMedia.data;
  }
}

function clearMedia(state, els) {
  state.secretMedia = null;
  els.photoPreview.src = '';
  els.videoPreview.src = '';
  els.mediaPreviewArea.classList.add('hidden');
  els.cameraStartArea.classList.remove('hidden');
  els.urlLengthWarning.classList.add('hidden');
  setCompressStatus(els, '');
  saveDraft(state, els);
}

function getMessageForEncode(state, els) {
  if (state.secretMode === SECRET_MODES.MEDIA) return '';
  return els.hiddenMessage.value;
}

function getMediaForEncode(state) {
  if (state.secretMode === SECRET_MODES.TEXT) return null;
  return state.secretMedia;
}

function setCompressStatus(els, text) {
  if (!els.compressStatus) return;
  if (!text) {
    els.compressStatus.textContent = '';
    els.compressStatus.classList.add('hidden');
    return;
  }
  els.compressStatus.textContent = text;
  els.compressStatus.classList.remove('hidden');
}

function getShareMode(els) {
  return els.shareModeHd?.checked ? 'hd' : 'standard';
}

function makePhotoUrlMeasurer(state, els, mode = null, externalPhotoUrl = null) {
  const shareMode = mode ?? getShareMode(els);
  const message = getMessageForEncode(state, els);
  const cells = state.cells;
  const limit = getShareUrlLimit(shareMode);
  return (photoDataUrl) => {
    const media = externalPhotoUrl ? null : { type: 'photo', data: photoDataUrl };
    const { encoded } = encodePuzzle(cells, message, media, { externalPhotoUrl });
    const url = buildShareUrl(encoded);
    return { length: url.length, fits: url.length <= limit, limit };
  };
}

async function generateShareLink(state, els) {
  const planted = countPlanted(state.cells);
  if (planted === 0) {
    alert('请至少种植一朵花再生成链接');
    return;
  }

  const shareMode = getShareMode(els);
  const urlLimit = getShareUrlLimit(shareMode);
  const message = getMessageForEncode(state, els);
  let secretMedia = getMediaForEncode(state);
  let externalPhotoUrl = null;
  let photoEmbedMode = null;
  let uploadFailed = false;
  let lengthWarning = null;

  if (state.secretMode !== SECRET_MODES.TEXT && !secretMedia) {
    alert('请先拍摄或选择一张照片/视频作为密语');
    return;
  }

  if (secretMedia?.type === 'video' && shareMode === 'standard') {
    alert(
      '视频密语链接过长，无法生成微信可分享的短链接。\n\n' +
      '请改用「照片密语」或「文字密语」。',
    );
    return;
  }

  if (secretMedia?.type === 'photo') {
    setCompressStatus(els, '正在优化照片以适合分享…');
    els.generateLinkBtn.disabled = true;
    let hdFallbackUsed = false;
    try {
      const measureUrl = makePhotoUrlMeasurer(state, els, shareMode);
      let result = await compressPhotoForShare(
        secretMedia.data,
        (dataUrl) => measureUrl(dataUrl).length,
        (msg) => setCompressStatus(els, msg),
        urlLimit,
        shareMode,
      );

      if (!result.fits && shareMode === 'hd') {
        setCompressStatus(els, '高清模式仍过长，正在进一步压缩…');
        const fallbackMeasure = makePhotoUrlMeasurer(state, els, 'standard');
        const fallbackResult = await compressPhotoForShare(
          secretMedia.data,
          (dataUrl) => fallbackMeasure(dataUrl).length,
          (msg) => setCompressStatus(els, msg),
          SHARE_URL_STANDARD_LENGTH,
          'standard',
        );
        if (fallbackResult.fits) {
          result = fallbackResult;
          hdFallbackUsed = true;
        }
      }

      if (!result.fits) {
        setCompressStatus(els, '正在上传照片…');
        try {
          const blob = await dataUrlToBlob(result.dataUrl);
          externalPhotoUrl = await uploadPhotoToHost(blob);
          photoEmbedMode = 'external';
          const externalMeasure = makePhotoUrlMeasurer(state, els, shareMode, externalPhotoUrl);
          const externalLen = externalMeasure(result.dataUrl).length;
          result = { ...result, urlLength: externalLen, fits: externalLen <= urlLimit };
        } catch (err) {
          console.warn('Photo upload failed', err);
          uploadFailed = true;
          photoEmbedMode = 'inline-fallback';
          lengthWarning =
            '照片上传失败，已使用最大压缩嵌入链接；二维码可能无法扫描，请换更小照片后重试。';
        }
      } else {
        photoEmbedMode = 'inline';
        secretMedia = { type: 'photo', data: result.dataUrl };
        state.secretMedia = secretMedia;
        saveDraft(state, els);
      }

      state._hdFallbackUsed = hdFallbackUsed;
      state._photoEmbedMode = photoEmbedMode;

      if (photoEmbedMode === 'external') {
        const externalMeasure = makePhotoUrlMeasurer(state, els, shareMode, externalPhotoUrl);
        const extLen = externalMeasure(result.dataUrl).length;
        setCompressStatus(
          els,
          `照片已上传云端（链接更短，约 ${extLen} 字符，24 小时内有效）`,
        );
      } else if (photoEmbedMode === 'inline') {
        const effectiveLimit = hdFallbackUsed ? SHARE_URL_STANDARD_LENGTH : urlLimit;
        const bytes = estimateDataUrlBytes(result.dataUrl);
        const statusMsg = hdFallbackUsed
          ? `照片已嵌入链接（约 ${formatBytes(bytes)}，链接约 ${result.urlLength} 字符）`
          : `照片已嵌入链接（约 ${formatBytes(bytes)}，链接约 ${result.urlLength} 字符，上限 ${effectiveLimit}）`;
        setCompressStatus(els, statusMsg);
      } else if (uploadFailed) {
        const bytes = estimateDataUrlBytes(result.dataUrl);
        setCompressStatus(
          els,
          `照片已嵌入链接（约 ${formatBytes(bytes)}，链接约 ${result.urlLength} 字符，上传失败）`,
        );
        secretMedia = { type: 'photo', data: result.dataUrl };
        state.secretMedia = secretMedia;
        saveDraft(state, els);
      }
    } finally {
      els.generateLinkBtn.disabled = false;
    }
  } else {
    state._hdFallbackUsed = false;
    state._photoEmbedMode = null;
  }

  const encodeOptions = externalPhotoUrl ? { externalPhotoUrl } : {};
  const mediaForEncode = externalPhotoUrl ? null : secretMedia;
  const result = encodePuzzle(state.cells, message, mediaForEncode, encodeOptions);

  const url = buildShareUrl(result.encoded);
  const effectiveLimit = state._hdFallbackUsed ? SHARE_URL_STANDARD_LENGTH : urlLimit;
  const assessment = assessUrlLength(url, effectiveLimit);

  if (secretMedia?.type === 'video' && assessment.tooLong) {
    lengthWarning =
      lengthWarning ||
      `视频密语链接较长（${assessment.length} 字符）。二维码可能无法扫描，请改用照片密语。`;
  } else if (assessment.tooLong && !externalPhotoUrl) {
    lengthWarning =
      lengthWarning ||
      `链接较长（${assessment.length} 字符，上限 ${urlLimit}）。请优先用二维码分享。`;
  }

  showShareWarnings(els, assessment, shareMode, state._hdFallbackUsed, {
    photoEmbedMode: state._photoEmbedMode,
    lengthWarning,
    uploadFailed,
  });

  els.shareUrl.value = url;
  els.shareResult.classList.remove('hidden');
  await renderShareQr(els, url, effectiveLimit);
  saveDraft(state, els);
}

async function renderShareQr(els, url, urlLimit) {
  const { shareQrWrap, shareQrCanvas, shareQrError } = els;
  if (!shareQrWrap || !shareQrCanvas) return;

  shareQrWrap.classList.remove('hidden');
  shareQrCanvas.classList.remove('hidden');
  if (shareQrError) {
    shareQrError.classList.add('hidden');
    shareQrError.textContent = '';
  }

  if (typeof QRCode === 'undefined') {
    shareQrCanvas.classList.add('hidden');
    if (shareQrError) {
      shareQrError.textContent = '二维码库未加载，请刷新页面后重试。';
      shareQrError.classList.remove('hidden');
    }
    return;
  }

  const errorCorrectionLevel = url.length > 1500 ? 'L' : 'M';
  const qrWidth = url.length > 2500 ? 320 : 260;

  return new Promise((resolve) => {
    QRCode.toCanvas(
      shareQrCanvas,
      url,
      {
        width: qrWidth,
        margin: 2,
        errorCorrectionLevel,
        color: { dark: '#1a1a1a', light: '#ffffff' },
      },
      (err) => {
        if (err) {
          console.error('QR code generation failed', err);
          shareQrCanvas.classList.add('hidden');
          if (shareQrError) {
            shareQrError.textContent =
              `二维码生成失败（链接 ${url.length} 字符，上限 ${urlLimit}）。请换更小照片或仅文字密语。`;
            shareQrError.classList.remove('hidden');
          }
          resolve(false);
          return;
        }
        shareQrWrap.classList.remove('hidden');
        resolve(true);
      },
    );
  });
}

function showShareWarnings(els, assessment, shareMode, hdFallbackUsed = false, extras = {}) {
  const { photoEmbedMode, lengthWarning, uploadFailed } = extras;
  els.shareLengthHint?.classList.add('hidden');
  els.localhostWarning.classList.add('hidden');

  const warnings = [];

  if (isLocalOrigin()) {
    els.localhostWarning.classList.remove('hidden');
    if (isUsingPublicOverride()) {
      els.localhostWarning.classList.remove('url-warning-danger');
      els.localhostWarning.classList.add('url-warning-info');
      els.localhostWarning.textContent =
        '本地开发中：分享链接与二维码已指向 GitHub Pages 线上地址，可直接扫码或复制分享。';
    } else {
      els.localhostWarning.classList.add('url-warning-danger');
      els.localhostWarning.classList.remove('url-warning-info');
      els.localhostWarning.textContent =
        '⚠️ 当前为本地地址（localhost），他人无法打开此域名。' +
        '请在 js/config.js 中设置 PUBLIC_BASE_URL 为 GitHub Pages 地址后再生成链接。';
    }
  }

  if (photoEmbedMode === 'external') {
    warnings.push(
      `照片已上传云端（链接 ${assessment.length} 字符，24 小时有效）。请用上方二维码分享。`,
    );
  } else if (photoEmbedMode === 'inline') {
    warnings.push(`照片已嵌入链接（${assessment.length} 字符）。`);
  }

  if (uploadFailed) {
    warnings.push('照片上传失败，已改用嵌入链接；若二维码无法扫描请换更小照片。');
  }

  if (lengthWarning) {
    warnings.push(lengthWarning);
  }

  if (hdFallbackUsed) {
    warnings.push(
      `照片已进一步压缩以生成可扫描链接（${assessment.length} 字符）。请用上方二维码分享。`,
    );
  } else if (shareMode === 'hd' && photoEmbedMode !== 'external') {
    warnings.push(
      `高清扫码：链接 ${assessment.length} 字符（上限 ${SHARE_URL_HD_LENGTH}）。` +
      '请用上方二维码分享，勿复制到微信聊天。',
    );
  } else if (assessment.length > SHARE_URL_SAFE_LENGTH) {
    warnings.push(
      `链接 ${assessment.length} 字符，超过微信聊天粘贴上限（约 ${SHARE_URL_SAFE_LENGTH}）。` +
      '请优先使用上方二维码分享。',
    );
  } else if (!photoEmbedMode) {
    warnings.push(
      `微信分享：链接 ${assessment.length} 字符（上限 ${SHARE_URL_SAFE_LENGTH}）。` +
      '推荐用上方二维码分享；短链接也可复制到微信聊天。',
    );
  }

  if (warnings.length && els.shareLengthHint) {
    els.shareLengthHint.classList.remove('hidden');
    els.shareLengthHint.textContent = warnings.join(' ');
  }
}

function paintSelectedCell(state) {
  if (state.selectedIndex >= 0) {
    state.cells[state.selectedIndex] = { ...state.tool };
  }
}

function refreshUI(state, els) {
  renderGardenGrid(state.cells, els.grid, {
    selectedIndex: state.selectedIndex,
    interactive: true,
    showEmoji: true,
    cellSize: 72,
    onCellClick: (index) => {
      state.selectedIndex = index;
      const cell = state.cells[index];
      if (isPlanted(cell)) {
        const same =
          cell.e === state.tool.e &&
          cell.r === state.tool.r &&
          cell.c === state.tool.c;
        if (same) {
          state.cells[index] = emptyCell();
        } else {
          state.tool = { e: cell.e, r: cell.r, c: cell.c };
          syncPalette(state.tool, els);
        }
      } else {
        state.cells[index] = { ...state.tool };
      }
      saveDraft(state, els);
      refreshUI(state, els);
    },
  });

  const selected = state.cells[state.selectedIndex] ?? state.tool;
  const previewCell = isPlanted(selected) ? selected : state.tool;
  els.cellPreview.innerHTML = generateFlowerSvg(previewCell, { size: 160, showEmoji: true });
  els.cellPreviewMeta.textContent = isPlanted(previewCell)
    ? `${getEmoji(previewCell.e)} · ${rotationIndexToDeg(previewCell.r)}° · ${getColor(previewCell.c).name}`
    : '选择或种植一格以预览';

  els.gardenOverview.innerHTML = state.cells
    .map((cell) => generateFlowerSvg(cell, { size: 36, showEmoji: true }))
    .join('');
}

function syncPalette(tool, els) {
  els.emojiPalette.querySelectorAll('.emoji-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === tool.e);
  });
  els.rotationPicker.querySelectorAll('.rot-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === tool.r);
  });
  els.colorPalette.querySelectorAll('.color-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === tool.c);
  });
}

function buildEmojiPalette(container, active, onPick) {
  container.innerHTML = '';
  EMOJIS.forEach((emoji, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `emoji-btn${i === active ? ' active' : ''}`;
    btn.textContent = emoji;
    btn.title = `emoji ${i + 1}`;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.emoji-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onPick(i);
    });
    container.appendChild(btn);
  });
}

function buildRotationPicker(container, active, onPick) {
  container.innerHTML = '';
  ROTATIONS.forEach((rot, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `rot-btn${i === active ? ' active' : ''}`;
    btn.textContent = rot.label;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.rot-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onPick(i);
    });
    container.appendChild(btn);
  });
}

function buildColorPalette(container, active, onPick) {
  container.innerHTML = '';
  COLORS.forEach((color, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `color-btn${i === active ? ' active' : ''}`;
    btn.style.setProperty('--swatch', color.hex);
    btn.title = color.name;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.color-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onPick(i);
    });
    container.appendChild(btn);
  });
}

function saveDraft(state, els) {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        cells: state.cells,
        message: els.hiddenMessage.value,
        secretMode: state.secretMode,
        secretMedia: state.secretMedia,
      }),
    );
  } catch {
    /* ignore quota errors */
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.cells) return null;
    return {
      cells: data.cells.map((c) => ({
        e: c.e ?? -1,
        r: c.r ?? 0,
        c: c.c ?? 0,
      })),
      message: data.message ?? '',
      secretMode: data.secretMode ?? SECRET_MODES.TEXT,
      secretMedia: data.secretMedia ?? null,
    };
  } catch {
    return null;
  }
}

export { buildEmojiPalette, buildRotationPicker, buildColorPalette };
