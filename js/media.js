import {
  MEDIA_STORAGE_PREFIX,
  SHARE_URL_HD_LENGTH,
  SHARE_URL_SAFE_LENGTH,
  SHARE_URL_STANDARD_LENGTH,
} from './constants.js';

const PHOTO_MAX_DIM = 1920;
const PHOTO_MIN_DIM = 480;
const PHOTO_QUALITY_HIGH = 0.88;
const PHOTO_QUALITY_LOW = 0.48;
const VIDEO_MAX_MS = 3000;
const VIDEO_BITRATE = 250000;

let webpSupported = null;

export const SECRET_MODES = {
  TEXT: 'text',
  MEDIA: 'media',
  BOTH: 'both',
};

export function hashPuzzleId(cells, message = '') {
  const str = JSON.stringify({ cells, msg: message });
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export async function openCamera(facingMode = 'environment') {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('此浏览器不支持相机');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  const track = stream.getVideoTracks()[0];
  const actualFacing = track?.getSettings?.().facingMode || facingMode;
  return { stream, unmirror: actualFacing === 'user' };
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Capture without selfie mirror; optionally un-mirror front-camera frames. */
export function capturePhotoFromStream(videoEl, { unmirror = false } = {}) {
  const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;
  if (!w || !h) throw new Error('相机尚未就绪');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (unmirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(videoEl, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', PHOTO_QUALITY_HIGH);
}

function supportsWebp() {
  if (webpSupported !== null) return webpSupported;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupported = canvas.toDataURL('image/webp', 0.8).startsWith('data:image/webp');
  } catch {
    webpSupported = false;
  }
  return webpSupported;
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法读取图片'));
    img.src = dataUrl;
  });
}

function encodeCanvas(canvas, quality) {
  const jpeg = canvas.toDataURL('image/jpeg', quality);
  if (!supportsWebp()) return jpeg;
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.length < jpeg.length ? webp : jpeg;
}

function resizeCanvas(img, maxDim) {
  let { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

export async function compressPhoto(dataUrl, options = {}) {
  const {
    maxDim = PHOTO_MAX_DIM,
    quality = PHOTO_QUALITY_HIGH,
  } = options;
  const img = await loadImage(dataUrl);
  const canvas = resizeCanvas(img, maxDim);
  return encodeCanvas(canvas, quality);
}

/** 微信分享 — aggressive ladder to fit ≤2048 char URLs. */
const COMPRESS_STEPS_WECHAT = [
  { maxDim: 1200, quality: 0.72 },
  { maxDim: 1000, quality: 0.65 },
  { maxDim: 900, quality: 0.58 },
  { maxDim: 800, quality: 0.52 },
  { maxDim: 640, quality: 0.48 },
  { maxDim: 560, quality: 0.44 },
  { maxDim: PHOTO_MIN_DIM, quality: PHOTO_QUALITY_LOW },
  { maxDim: 400, quality: 0.38 },
  { maxDim: 320, quality: 0.34 },
];

/** 高清扫码 — moderate ladder to fit ≤2500 char URLs with better quality. */
const COMPRESS_STEPS_HD = [
  { maxDim: 1600, quality: 0.82 },
  { maxDim: 1400, quality: 0.76 },
  { maxDim: 1200, quality: 0.70 },
  { maxDim: 1000, quality: 0.64 },
  { maxDim: 900, quality: 0.58 },
  { maxDim: 800, quality: 0.52 },
  { maxDim: 640, quality: 0.48 },
  { maxDim: PHOTO_MIN_DIM, quality: PHOTO_QUALITY_LOW },
  { maxDim: 400, quality: 0.38 },
];

function getCompressSteps(mode = 'standard') {
  return mode === 'hd' ? COMPRESS_STEPS_HD : COMPRESS_STEPS_WECHAT;
}

export function getShareUrlLimit(mode = 'standard') {
  if (mode === 'hd') return SHARE_URL_HD_LENGTH;
  return SHARE_URL_STANDARD_LENGTH;
}

export async function compressPhotoForShare(
  dataUrl,
  measureUrlLength,
  onProgress,
  maxUrlLength = SHARE_URL_STANDARD_LENGTH,
  mode = 'standard',
) {
  const steps = getCompressSteps(mode);
  const initialLen = measureUrlLength(dataUrl);

  if (initialLen <= maxUrlLength) {
    return { dataUrl, urlLength: initialLen, fits: true };
  }

  let best = dataUrl;
  let bestLen = initialLen;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    onProgress?.(`正在压缩… (${i + 1}/${steps.length})`);
    const compressed = await compressPhoto(dataUrl, step);
    const len = measureUrlLength(compressed);
    best = compressed;
    bestLen = len;
    if (len <= maxUrlLength) {
      return { dataUrl: compressed, urlLength: len, fits: true };
    }
  }

  return { dataUrl: best, urlLength: bestLen, fits: bestLen <= maxUrlLength };
}

export function estimateDataUrlBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.ceil(base64.length * 0.75);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readFileAsPhoto(file, options = {}) {
  const { onProgress } = options;
  onProgress?.('正在读取照片…');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('无法读取文件'));
    reader.readAsDataURL(file);
  });
  onProgress?.('正在压缩…');
  return compressPhoto(dataUrl, { maxDim: PHOTO_MAX_DIM, quality: PHOTO_QUALITY_HIGH });
}

export function recordVideoFromStream(stream, maxMs = VIDEO_MAX_MS) {
  return new Promise((resolve, reject) => {
    const mimeCandidates = [
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mimeType) {
      reject(new Error('此浏览器不支持视频录制'));
      return;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITRATE,
    });
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = () => reject(new Error('录制失败'));

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result, mimeType });
      reader.onerror = () => reject(new Error('无法读取视频'));
      reader.readAsDataURL(blob);
    };

    recorder.start(100);
    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, maxMs);
  });
}

export function storeMediaRef(ref, secretMedia) {
  try {
    localStorage.setItem(
      `${MEDIA_STORAGE_PREFIX}${ref}`,
      JSON.stringify(secretMedia),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadMediaRef(ref) {
  try {
    const raw = localStorage.getItem(`${MEDIA_STORAGE_PREFIX}${ref}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.type || !data?.data) return null;
    return data;
  } catch {
    return null;
  }
}

export function normalizeSecretMedia(media) {
  if (!media) return null;
  if (media.type && media.data) return media;
  if (media.t && media.d) {
    return {
      type: media.t === 'v' ? 'video' : 'photo',
      data: media.d,
    };
  }
  return null;
}

export function compactSecretMedia(media) {
  if (!media) return null;
  return {
    t: media.type === 'video' ? 'v' : 'p',
    d: media.data,
  };
}

export function resolveSecretMedia(puzzle) {
  if (puzzle.secretMedia) return normalizeSecretMedia(puzzle.secretMedia);
  if (puzzle.mediaRef) return loadMediaRef(puzzle.mediaRef);
  return null;
}

export function assessUrlLength(url, limit = SHARE_URL_STANDARD_LENGTH) {
  const len = url.length;
  return {
    length: len,
    limit,
    tooLong: len > limit,
    warning: len > limit * 0.85,
    chatPasteRisk: len > SHARE_URL_SAFE_LENGTH,
  };
}

export const PHOTO_COMPRESS_PARAMS = {
  maxDim: PHOTO_MAX_DIM,
  minDim: PHOTO_MIN_DIM,
  qualityHigh: PHOTO_QUALITY_HIGH,
  qualityLow: PHOTO_QUALITY_LOW,
  stepsWechat: COMPRESS_STEPS_WECHAT,
  stepsHd: COMPRESS_STEPS_HD,
};
