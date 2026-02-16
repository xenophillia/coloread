const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const thresholdHud = document.getElementById('thresholdHud');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValueEl = document.getElementById('thresholdValue');
const maskSizeSlider = document.getElementById('maskSizeSlider');
const maskSizeValueEl = document.getElementById('maskSizeValue');
const maskBlurSlider = document.getElementById('maskBlurSlider');
const maskBlurValueEl = document.getElementById('maskBlurValue');

const sourceVideo = document.createElement('video');
sourceVideo.playsInline = true;
sourceVideo.muted = true;

const THRESHOLD = 128;
const BLINK_EAR_THRESHOLD = 0.205;
const BLINK_RESET_THRESHOLD = 0.235;
const BLINK_COOLDOWN_MS = 220;
const MESH_INTERVAL_MS = 66;

let animationId = null;
let mediaStream = null;
let darkColor = [0, 0, 0];
let lightColor = [255, 255, 255];
let thresholdSetting = THRESHOLD;
let maskSizeSetting = Number(maskSizeSlider.value);
let maskBlurSetting = Number(maskBlurSlider.value);
let activeColorMode = 'c';
const modeHighState = {
  v: false,
  h: false,
  s: false,
  c: false,
};

let faceMesh = null;
let faceMeshReady = false;
let meshInFlight = false;
let latestFaces = [];
let lastMeshAt = 0;
let blinkClosed = false;
let lastBlinkAt = 0;
let speechRecognition = null;
let speechEnabled = false;
let heardWords = [];
let interimHeard = '';
let pinnedKeywordWords = [];
let audioStream = null;
let audioCtx = null;
let audioAnalyser = null;
let audioData = null;
let volumeEma = 0.02;
let pitchEma = 180;

let videoLayerCanvas = document.createElement('canvas');
let videoLayerCtx = videoLayerCanvas.getContext('2d');
let maskCanvas = document.createElement('canvas');
let maskCtx = maskCanvas.getContext('2d');
let textCanvas = document.createElement('canvas');
let textCtx = textCanvas.getContext('2d');

const LEFT_EYE_INDICES = [33, 133, 160, 159, 158, 157, 173, 246, 161, 144, 145, 153, 154, 155];
const RIGHT_EYE_INDICES = [362, 263, 387, 386, 385, 384, 398, 466, 388, 373, 374, 380, 381, 382];
const LEFT_BROW_INDICES = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const RIGHT_BROW_INDICES = [336, 296, 334, 293, 300, 285, 295, 282, 283, 276];
const SPEECH_PHRASES = [
  { phrase: 'barbie', label: 'Barbie Pink', hex: '#E0218A' },
  { phrase: 'yale', label: 'Yale Blue', hex: '#00356B' },
  { phrase: 'google', label: 'Google Blue', hex: '#4285F4' },
  { phrase: 'amazon', label: 'Amazon Orange', hex: '#FF9900' },
  { phrase: 'apple', label: 'Apple Gray', hex: '#A2AAAD' },
  { phrase: 'microsoft', label: 'Microsoft Blue', hex: '#00A3EE' },
  { phrase: 'meta', label: 'Meta Blue', hex: '#0668E1' },
  { phrase: 'facebook', label: 'Facebook Blue', hex: '#1877F2' },
  { phrase: 'instagram', label: 'Instagram Purple', hex: '#C13584' },
  { phrase: 'twitter', label: 'Twitter Blue', hex: '#1DA1F2' },
  { phrase: 'linkedin', label: 'LinkedIn Blue', hex: '#0A66C2' },
  { phrase: 'paypal credit', label: 'PayPal Credit Blue', hex: '#009CDE' },
  { phrase: 'paypal', label: 'PayPal Blue', hex: '#003087' },
  { phrase: 'intel', label: 'Intel Blue', hex: '#0071C5' },
  { phrase: 'ibm', label: 'IBM Blue', hex: '#0F62FE' },
  { phrase: 'hp', label: 'HP Blue', hex: '#0096D6' },
  { phrase: 'dell', label: 'Dell Blue', hex: '#007DB8' },
  { phrase: 'nvidia', label: 'NVIDIA Green', hex: '#76B900' },
  { phrase: 'amd', label: 'AMD Green', hex: '#ED1C24' },
  { phrase: 'adobe', label: 'Adobe Red', hex: '#FF0000' },
  { phrase: 'figma', label: 'Figma Orange', hex: '#F24E1E' },
  { phrase: 'slack', label: 'Slack Aubergine', hex: '#4A154B' },
  { phrase: 'spotify', label: 'Spotify Green', hex: '#1DB954' },
  { phrase: 'netflix', label: 'Netflix Red', hex: '#E50914' },
  { phrase: 'youtube', label: 'YouTube Red', hex: '#FF0000' },
  { phrase: 'twitch', label: 'Twitch Purple', hex: '#9146FF' },
  { phrase: 'discord', label: 'Discord Blurple', hex: '#5865F2' },
  { phrase: 'reddit', label: 'Reddit Orange', hex: '#FF4500' },
  { phrase: 'pinterest', label: 'Pinterest Red', hex: '#E60023' },
  { phrase: 'snapchat', label: 'Snapchat Yellow', hex: '#FFFC00' },
  { phrase: 'tiktok', label: 'TikTok Cyan', hex: '#25F4EE' },
  { phrase: 'vimeo', label: 'Vimeo Blue', hex: '#1AB7EA' },
  { phrase: 'behance', label: 'Behance Blue', hex: '#1769FF' },
  { phrase: 'nike', label: 'Nike Black', hex: '#111111' },
  { phrase: 'adidas', label: 'Adidas Black', hex: '#000000' },
  { phrase: 'puma', label: 'Puma Red', hex: '#E41E26' },
  { phrase: 'reebok', label: 'Reebok Red', hex: '#C41230' },
  { phrase: 'new balance', label: 'New Balance Red', hex: '#CE2724' },
  { phrase: 'supreme', label: 'Supreme Red', hex: '#DA2725' },
  { phrase: 'uniqlo', label: 'Uniqlo Red', hex: '#E60012' },
  { phrase: 'zara', label: 'Zara Black', hex: '#000000' },
  { phrase: 'gucci', label: 'Gucci Green', hex: '#1A4D2E' },
  { phrase: 'prada', label: 'Prada Green', hex: '#003D2B' },
  { phrase: 'cartier', label: 'Cartier Red', hex: '#841B2D' },
  { phrase: 'tiffany', label: 'Tiffany Blue', hex: '#81D8D0' },
  { phrase: 'hermes', label: 'Hermes Orange', hex: '#FF6F00' },
  { phrase: 'valentino', label: 'Valentino Red', hex: '#FC2222' },
  { phrase: 'burberry', label: 'Burberry Beige', hex: '#B8A081' },
  { phrase: 'bottega', label: 'Bottega Green', hex: '#00A94F' },
  { phrase: 'chanel', label: 'Chanel Black', hex: '#000000' },
  { phrase: 'dior', label: 'Dior Gray', hex: '#8C8C8C' },
  { phrase: 'louis vuitton', label: 'LV Brown', hex: '#4B3621' },
  { phrase: 'fendi', label: 'Fendi Yellow', hex: '#F4C300' },
  { phrase: 'coca cola', label: 'Coca-Cola Red', hex: '#F40009' },
  { phrase: 'pepsi', label: 'Pepsi Blue', hex: '#004B93' },
  { phrase: 'starbucks', label: 'Starbucks Green', hex: '#00704A' },
  { phrase: 'mcdonalds', label: "McDonald's Red", hex: '#DA291C' },
  { phrase: 'burger king', label: 'Burger King Orange', hex: '#F5A623' },
  { phrase: 'kfc', label: 'KFC Red', hex: '#C41230' },
  { phrase: 'dominos', label: "Domino's Blue", hex: '#006491' },
  { phrase: 'pizza hut', label: 'Pizza Hut Red', hex: '#EE3124' },
  { phrase: 'subway', label: 'Subway Green', hex: '#009A44' },
  { phrase: 'chipotle', label: 'Chipotle Red', hex: '#A81612' },
  { phrase: 'ikea', label: 'IKEA Blue', hex: '#0057AD' },
  { phrase: 'target', label: 'Target Red', hex: '#CC0000' },
  { phrase: 'walmart', label: 'Walmart Blue', hex: '#0071CE' },
  { phrase: 'costco', label: 'Costco Red', hex: '#E31837' },
  { phrase: 'best buy', label: 'Best Buy Yellow', hex: '#FFF200' },
  { phrase: 'home depot', label: 'Home Depot Orange', hex: '#F96302' },
  { phrase: 'lowes', label: "Lowe's Blue", hex: '#004990' },
  { phrase: 'ups', label: 'UPS Brown', hex: '#673412' },
  { phrase: 'fedex', label: 'FedEx Purple', hex: '#4D148C' },
  { phrase: 'dhl', label: 'DHL Yellow', hex: '#FFCC00' },
  { phrase: 'ford', label: 'Ford Blue', hex: '#003399' },
  { phrase: 'tesla', label: 'Tesla Red', hex: '#CC0000' },
  { phrase: 'bmw', label: 'BMW Blue', hex: '#0066B1' },
  { phrase: 'mercedes', label: 'Mercedes Silver', hex: '#A7A8AA' },
  { phrase: 'audi', label: 'Audi Gray', hex: '#BBBCBC' },
  { phrase: 'toyota', label: 'Toyota Red', hex: '#EB0A1E' },
  { phrase: 'honda', label: 'Honda Red', hex: '#DA251D' },
  { phrase: 'volkswagen', label: 'VW Blue', hex: '#001E50' },
  { phrase: 'porsche', label: 'Porsche Gold', hex: '#B8965E' },
  { phrase: 'ferrari', label: 'Ferrari Red', hex: '#FF2800' },
  { phrase: 'airbnb', label: 'Airbnb Coral', hex: '#FF5A5F' },
  { phrase: 'uber', label: 'Uber Black', hex: '#000000' },
  { phrase: 'lyft', label: 'Lyft Pink', hex: '#FF00BF' },
  { phrase: 'booking', label: 'Booking Blue', hex: '#003580' },
  { phrase: 'expedia', label: 'Expedia Yellow', hex: '#FFC72C' },
  { phrase: 'delta', label: 'Delta Red', hex: '#C8102E' },
  { phrase: 'american airlines', label: 'AA Blue', hex: '#0078D2' },
  { phrase: 'united airlines', label: 'United Blue', hex: '#005DAA' },
  { phrase: 'lufthansa', label: 'Lufthansa Blue', hex: '#05164D' },
  { phrase: 'emirates', label: 'Emirates Red', hex: '#D71921' },
  { phrase: 'visa', label: 'Visa Blue', hex: '#1A1F71' },
  { phrase: 'mastercard', label: 'Mastercard Orange', hex: '#EB001B' },
  { phrase: 'amex', label: 'American Express Blue', hex: '#2E77BB' },
  { phrase: 'stripe', label: 'Stripe Purple', hex: '#635BFF' },
  { phrase: 'square', label: 'Square Black', hex: '#000000' },
  { phrase: 'robinhood', label: 'Robinhood Green', hex: '#00C805' },
  { phrase: 'coinbase', label: 'Coinbase Blue', hex: '#0052FF' },
  { phrase: 'binance', label: 'Binance Yellow', hex: '#F3BA2F' },
  { phrase: 'wise', label: 'Wise Green', hex: '#00B9FF' },
  { phrase: 'national geographic', label: 'NatGeo Yellow', hex: '#FFCC00' },
  { phrase: 'bbc', label: 'BBC Red', hex: '#B80000' },
  { phrase: 'cnn', label: 'CNN Red', hex: '#CC0000' },
  { phrase: 'time magazine', label: 'Time Red', hex: '#E90606' },
  { phrase: 'new york times', label: 'NYT Black', hex: '#000000' },
  { phrase: 'guardian', label: 'Guardian Blue', hex: '#052962' },
  { phrase: 'wired', label: 'Wired Pink', hex: '#FF0080' },
  { phrase: 'rolling stone', label: 'Rolling Stone Red', hex: '#D2232A' },
  { phrase: 'mtv', label: 'MTV Yellow', hex: '#FFED00' },
  { phrase: 'hbo', label: 'HBO Black', hex: '#000000' },
  { phrase: 'lego', label: 'LEGO Red', hex: '#D01012' },
  { phrase: 'playstation', label: 'PlayStation Blue', hex: '#003791' },
  { phrase: 'xbox', label: 'Xbox Green', hex: '#107C10' },
  { phrase: 'nintendo', label: 'Nintendo Red', hex: '#E60012' },
  { phrase: 'sega', label: 'SEGA Blue', hex: '#0089CF' },
  { phrase: 'epic games', label: 'Epic Black', hex: '#000000' },
  { phrase: 'steam', label: 'Steam Blue', hex: '#1B2838' },
  { phrase: 'riot games', label: 'Riot Red', hex: '#D13639' },
  { phrase: 'ea sports', label: 'EA Red', hex: '#FF1E00' },
  { phrase: 'ubisoft', label: 'Ubisoft Blue', hex: '#0055A5' },
  { phrase: 'red bull', label: 'Red Bull Blue', hex: '#003399' },
  { phrase: 'monster energy', label: 'Monster Green', hex: '#6FBE44' },
  { phrase: 'gatorade', label: 'Gatorade Orange', hex: '#FF5F00' },
  { phrase: 'powerade', label: 'Powerade Blue', hex: '#005BBB' },
  { phrase: 'evian', label: 'Evian Pink', hex: '#FFB6C1' },
  { phrase: 'perrier', label: 'Perrier Green', hex: '#006B3C' },
  { phrase: 'heineken', label: 'Heineken Green', hex: '#008200' },
  { phrase: 'guinness', label: 'Guinness Black', hex: '#0A0A0A' },
  { phrase: 'absolut', label: 'Absolut Blue', hex: '#003A8F' },
  { phrase: 'smirnoff', label: 'Smirnoff Red', hex: '#C8102E' },
].sort((a, b) => b.phrase.length - a.phrase.length);

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ensureOffscreenSize(canvas.width, canvas.height);
}

function ensureOffscreenSize(width, height) {
  if (videoLayerCanvas.width !== width || videoLayerCanvas.height !== height) {
    videoLayerCanvas.width = width;
    videoLayerCanvas.height = height;
    maskCanvas.width = width;
    maskCanvas.height = height;
    textCanvas.width = width;
    textCanvas.height = height;
  }
}

function normalizeAudioLevel(rms) {
  const min = 0.006;
  const max = 0.09;
  return Math.max(0, Math.min(1, (rms - min) / (max - min)));
}

function estimatePitchHz(buffer, sampleRate) {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i += 1) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) {
    return null;
  }

  let bestOffset = -1;
  let bestCorr = 0;
  const minLag = Math.floor(sampleRate / 360);
  const maxLag = Math.floor(sampleRate / 70);

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let corr = 0;
    for (let i = 0; i < size - lag; i += 1) {
      corr += buffer[i] * buffer[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = lag;
    }
  }

  if (bestOffset <= 0) {
    return null;
  }
  return sampleRate / bestOffset;
}

async function startAudioAnalysis() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    return;
  }

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    return;
  }

  audioCtx = new Ctx();
  const source = audioCtx.createMediaStreamSource(audioStream);
  audioAnalyser = audioCtx.createAnalyser();
  audioAnalyser.fftSize = 2048;
  audioAnalyser.smoothingTimeConstant = 0.2;
  source.connect(audioAnalyser);
  audioData = new Float32Array(audioAnalyser.fftSize);
}

function stopAudioAnalysis() {
  if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
    audioStream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  audioAnalyser = null;
  audioData = null;
}

function updateAudioFeatures() {
  if (!audioAnalyser || !audioData || !audioCtx) {
    return;
  }
  audioAnalyser.getFloatTimeDomainData(audioData);

  let rms = 0;
  for (let i = 0; i < audioData.length; i += 1) {
    rms += audioData[i] * audioData[i];
  }
  rms = Math.sqrt(rms / audioData.length);
  const vol = normalizeAudioLevel(rms);
  volumeEma += (vol - volumeEma) * 0.48;

  const pitch = estimatePitchHz(audioData, audioCtx.sampleRate);
  if (pitch && Number.isFinite(pitch)) {
    pitchEma += (pitch - pitchEma) * 0.18;
  }
}

function randomColor() {
  while (true) {
    const color = [
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
    ];
    const spread = Math.max(...color) - Math.min(...color);
    if (spread > 75) {
      return color;
    }
  }
}

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function rgbToHsv(rgb) {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d) % 6;
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h /= 6;
    if (h < 0) {
      h += 1;
    }
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hueDistance(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function checkModeContrast(baseRgb, nextRgb, mode, high) {
  const baseHsv = rgbToHsv(baseRgb);
  const nextHsv = rgbToHsv(nextRgb);
  const hDiff = hueDistance(baseHsv.h, nextHsv.h);
  const sDiff = Math.abs(baseHsv.s - nextHsv.s);
  const vDiff = Math.abs(baseHsv.v - nextHsv.v);
  const dist = colorDistance(baseRgb, nextRgb);

  if (mode === 'v') {
    return high ? vDiff >= 0.42 : vDiff <= 0.14;
  }
  if (mode === 'h') {
    return high ? hDiff >= 0.27 : hDiff <= 0.08;
  }
  if (mode === 's') {
    return high ? sDiff >= 0.44 : sDiff <= 0.14;
  }

  if (high) {
    return dist >= 185 || (hDiff >= 0.2 && sDiff >= 0.26) || vDiff >= 0.4;
  }
  return dist >= 35 && dist <= 110 && hDiff <= 0.15 && sDiff <= 0.22 && vDiff <= 0.2;
}

function randomColorByMode(baseRgb, mode, high) {
  let fallback = randomColor();
  for (let i = 0; i < 160; i += 1) {
    const candidate = randomColor();
    if (checkModeContrast(baseRgb, candidate, mode, high)) {
      return candidate;
    }
    fallback = candidate;
  }
  return fallback;
}

function rgbToCss(color) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function hexToRgb(hex) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function syncUiColor() {
  document.documentElement.style.setProperty('--ui-color', rgbToCss(darkColor));
}

function normalizeHeard(text) {
  return text
    .replace(/[^a-zA-Z0-9\s]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function splitNormalizedWords(text) {
  return normalizeHeard(text).split(' ').filter(Boolean);
}

function currentWordStyle() {
  const v = Math.max(0, Math.min(1, volumeEma));
  const sizeScale = 0.2 + Math.pow(v, 0.55) * 4.6;
  return {
    sizeScale,
    italic: pitchEma >= 220,
    caps: pitchEma <= 145,
  };
}

function pushHeardWords(text) {
  pushHeardWordTokens(splitNormalizedWords(text), currentWordStyle());
}

function pushHeardWordTokens(words, style) {
  if (!words || words.length === 0) {
    return;
  }
  for (const w of words) {
    heardWords.push({
      text: w,
      sizeScale: style.sizeScale,
      italic: style.italic,
      caps: style.caps,
    });
  }
}

function textLayout(cw, ch) {
  const hudVisible = thresholdHud.classList.contains('show');
  const topReserve = hudVisible ? 44 : 10;
  const fontSize = Math.max(56, Math.min(192, Math.round(ch * 0.15)));
  const lineHeight = Math.round(fontSize * 1.15);
  const left = Math.round(cw * 0.015);
  const top = topReserve;
  const rightPad = Math.round(cw * 0.03);
  const bottomPad = Math.round(ch * 0.08);
  const width = Math.max(120, cw - left - rightPad);
  const maxLines = Math.max(1, Math.floor((ch - top - bottomPad) / lineHeight));
  return { fontSize, lineHeight, left, top, width, maxLines };
}

function wordFont(baseSize, token) {
  const size = Math.max(20, Math.round(baseSize * token.sizeScale));
  return `${token.italic ? 'italic ' : ''}700 ${size}px "Spectral", serif`;
}

function interimWordTokens() {
  const normalized = normalizeHeard(interimHeard);
  if (!normalized) {
    return [];
  }

  const style = currentWordStyle();
  return normalized.split(' ').filter(Boolean).map((w) => ({
    text: w,
    sizeScale: style.sizeScale,
    italic: style.italic,
    caps: style.caps,
  }));
}

function layoutWordTokens(ctx2d, tokens, layout) {
  const placed = [];
  let row = 0;
  let x = layout.left;
  let y = layout.top;
  let rowHeight = layout.lineHeight;

  for (const token of tokens) {
    const text = token.caps ? token.text.toUpperCase() : token.text;
    const font = wordFont(layout.fontSize, token);
    ctx2d.font = font;
    const width = ctx2d.measureText(text).width;
    const space = ctx2d.measureText(' ').width;
    const tokenH = Math.max(14, Math.round(layout.fontSize * token.sizeScale * 1.08));

    if (x > layout.left && x + width > layout.left + layout.width) {
      row += 1;
      x = layout.left;
      y += rowHeight;
      rowHeight = layout.lineHeight;
    }

    rowHeight = Math.max(rowHeight, tokenH);
    placed.push({ text, font, x, y, row });
    x += width + space;
  }

  return placed;
}

function trimHeardLines(cw, ch, includeInterim) {
  const layout = textLayout(cw, ch);
  while (true) {
    const tokens = heardWords;
    const placed = layoutWordTokens(textCtx, tokens, layout);
    const rowsUsed = placed.length > 0 ? placed[placed.length - 1].row + 1 : 0;
    if (rowsUsed <= layout.maxLines) {
      break;
    }
    heardWords.shift();
    if (heardWords.length === 0) {
      break;
    }
  }
}

function estimateFaceSizeNormalized() {
  if (latestFaces.length === 0) {
    return null;
  }

  const landmarks = latestFaces[0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of landmarks) {
    if (!point) {
      continue;
    }
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  if (!Number.isFinite(minX)) {
    return null;
  }
  return Math.max(maxX - minX, maxY - minY);
}

function textBlurFromDistance() {
  const faceSize = estimateFaceSizeNormalized();
  if (!faceSize) {
    return 4;
  }

  const farRef = 0.14;
  const nearRef = 0.38;
  const t = Math.max(0, Math.min(1, (faceSize - farRef) / (nearRef - farRef)));
  return Math.round(2 + t * 20);
}

function drawBlurText(ctx2d, text, x, y, blurPx) {
  const steps = Math.max(6, Math.round(blurPx * 1.2));
  for (let i = 0; i < steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const ox = Math.cos(t) * blurPx;
    const oy = Math.sin(t) * blurPx;
    ctx2d.fillStyle = 'rgba(255,255,255,0.07)';
    ctx2d.fillText(text, x + ox, y + oy);
  }
  ctx2d.fillStyle = 'rgba(255,255,255,0.95)';
  ctx2d.fillText(text, x, y);
}

function drawStrokeText(ctx2d, text, x, y, blurPx, lineWidth) {
  const steps = Math.max(6, Math.round(blurPx * 1.2));
  const lw = Math.max(1, lineWidth);
  ctx2d.lineJoin = 'round';
  ctx2d.lineCap = 'round';
  ctx2d.lineWidth = lw;

  for (let i = 0; i < steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const ox = Math.cos(t) * blurPx;
    const oy = Math.sin(t) * blurPx;
    ctx2d.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx2d.strokeText(text, x + ox, y + oy);
  }

  ctx2d.strokeStyle = 'rgba(255,255,255,0.98)';
  ctx2d.strokeText(text, x, y);
}

function phraseMatchAt(words, startIndex) {
  for (const entry of SPEECH_PHRASES) {
    const phraseWords = entry.phrase.split(' ');
    if (startIndex + phraseWords.length > words.length) {
      continue;
    }
    let matched = true;
    for (let i = 0; i < phraseWords.length; i += 1) {
      if (words[startIndex + i] !== phraseWords[i]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return { entry, length: phraseWords.length };
    }
  }
  return null;
}

function pinRecognizedPhrase(phraseText, style) {
  const cw = canvas.width || window.innerWidth;
  const ch = canvas.height || window.innerHeight;
  const layout = textLayout(cw, ch);
  const token = {
    text: phraseText,
    sizeScale: style.sizeScale,
    italic: style.italic,
    caps: style.caps,
  };

  const placed = layoutWordTokens(textCtx, [...heardWords, token], layout);
  const last = placed[placed.length - 1];
  if (!last) {
    return;
  }

  pinnedKeywordWords.push({
    text: last.text,
    font: last.font,
    x: last.x,
    y: last.y,
    strokeWidth: Math.max(2, Math.round(layout.fontSize * token.sizeScale * 0.06)),
  });

  if (pinnedKeywordWords.length > 160) {
    pinnedKeywordWords.shift();
  }
}

function drawTranscriptLayer(cw, ch) {
  textCtx.clearRect(0, 0, cw, ch);
  const layout = textLayout(cw, ch);
  const blurPx = textBlurFromDistance();

  textCtx.textAlign = 'left';
  textCtx.textBaseline = 'top';

  const tokens = heardWords;
  const placed = layoutWordTokens(textCtx, tokens, layout);
  if (placed.length > 0) {
    const maxRow = placed[placed.length - 1].row;
    const minRow = Math.max(0, maxRow - layout.maxLines + 1);

    for (const token of placed) {
      if (token.row < minRow) {
        continue;
      }
      textCtx.font = token.font;
      drawBlurText(textCtx, token.text, token.x, token.y, blurPx);
    }
  }

  for (const token of pinnedKeywordWords) {
    textCtx.font = token.font;
    drawStrokeText(textCtx, token.text, token.x, token.y, blurPx, token.strokeWidth);
  }
}

function initRandomColors() {
  let nextDark = randomColor();
  let nextLight = randomColor();

  while (colorDistance(nextDark, nextLight) < 180) {
    nextLight = randomColor();
  }

  darkColor = nextDark;
  lightColor = nextLight;
  syncUiColor();
}

function cycleColorsAfterBlink() {
  const previousLight = lightColor;
  const nextLight = randomColorByMode(previousLight, activeColorMode, modeHighState[activeColorMode]);

  darkColor = previousLight;
  lightColor = nextLight;
  syncUiColor();
}

function applySpeechPhrase(transcript, style) {
  const words = splitNormalizedWords(transcript);
  if (words.length === 0) {
    return false;
  }

  let found = false;
  let i = 0;
  while (i < words.length) {
    const match = phraseMatchAt(words, i);
    if (match) {
      found = true;
      lightColor = hexToRgb(match.entry.hex);
      pinRecognizedPhrase(match.entry.phrase, style);
      i += match.length;
      continue;
    }
    pushHeardWordTokens([words[i]], style);
    i += 1;
  }
  return found;
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return;
  }

  speechRecognition = new SpeechRecognition();
  speechRecognition.lang = 'en-US';
  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;
  speechEnabled = true;

  speechRecognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result[0]?.transcript?.trim() ?? '';
      if (!text) {
        continue;
      }

      if (result.isFinal) {
        const style = currentWordStyle();
        applySpeechPhrase(text, style);
        interimHeard = '';
      } else {
        interim = text;
      }
    }
    interimHeard = normalizeHeard(interim);
    trimHeardLines(canvas.width, canvas.height, Boolean(interimHeard));
  };

  speechRecognition.onerror = () => {
    if (speechEnabled && heardWords.length === 0) {
      pushHeardWords('mic blocked');
    }
  };

  speechRecognition.onend = () => {
    if (!speechEnabled) {
      return;
    }
    try {
      speechRecognition.start();
    } catch {
      // Ignore restart race.
    }
  };

  try {
    speechRecognition.start();
  } catch {
    pushHeardWords('mic start failed');
  }
}

function toggleColorMode(mode) {
  activeColorMode = mode;
  modeHighState[mode] = !modeHighState[mode];
  cycleColorsAfterBlink();
}

function initFaceMesh() {
  if (!window.FaceMesh) {
    console.error('MediaPipe Face Mesh failed to load.');
    return;
  }

  faceMesh = new window.FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults((results) => {
    latestFaces = results?.multiFaceLandmarks ?? [];
    meshInFlight = false;
    detectBlinkAndRandomize();
  });

  faceMeshReady = true;
}

function requestFaceMesh() {
  if (!faceMeshReady) {
    return;
  }
  if (!sourceVideo.videoWidth || !sourceVideo.videoHeight) {
    return;
  }
  if (meshInFlight) {
    return;
  }

  const now = performance.now();
  if (now - lastMeshAt < MESH_INTERVAL_MS) {
    return;
  }

  lastMeshAt = now;
  meshInFlight = true;
  faceMesh.send({ image: sourceVideo }).catch(() => {
    meshInFlight = false;
  });
}

function eyeAspectRatio(landmarks, a, b, c, d, e, f) {
  const pA = landmarks[a];
  const pB = landmarks[b];
  const pC = landmarks[c];
  const pD = landmarks[d];
  const pE = landmarks[e];
  const pF = landmarks[f];
  if (!pA || !pB || !pC || !pD || !pE || !pF) {
    return null;
  }

  const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
  const horizontal = dist(pA, pD);
  if (horizontal < 1e-4) {
    return null;
  }
  const vertical = dist(pB, pF) + dist(pC, pE);
  return vertical / (2 * horizontal);
}

function detectBlinkAndRandomize() {
  if (latestFaces.length === 0) {
    blinkClosed = false;
    return;
  }

  const landmarks = latestFaces[0];
  const leftEAR = eyeAspectRatio(landmarks, 33, 159, 158, 133, 153, 145);
  const rightEAR = eyeAspectRatio(landmarks, 362, 386, 385, 263, 380, 374);
  if (leftEAR == null || rightEAR == null) {
    return;
  }

  const ear = (leftEAR + rightEAR) / 2;
  const now = performance.now();

  if (!blinkClosed && ear < BLINK_EAR_THRESHOLD && now - lastBlinkAt > BLINK_COOLDOWN_MS) {
    blinkClosed = true;
    lastBlinkAt = now;
    cycleColorsAfterBlink();
    return;
  }

  if (blinkClosed && ear > BLINK_RESET_THRESHOLD) {
    blinkClosed = false;
  }
}

function convexHull(points) {
  if (points.length <= 2) {
    return points;
  }

  const sorted = points
    .map((p) => ({ x: p.x, y: p.y }))
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function getExpandedHull(landmarks, indices, dx, dy, drawW, drawH, padding) {
  const points = [];
  for (const index of indices) {
    const point = landmarks[index];
    if (!point) {
      continue;
    }
    points.push({
      x: dx + point.x * drawW,
      y: dy + point.y * drawH,
    });
  }
  if (points.length < 3) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // Squeeze horizontally to avoid side/peripheral hair area while preserving vertical coverage.
  const expandX = 0.86 + padding * 0.015;
  const expandY = 1 + padding * 0.01;

  const expanded = points.map((p) => ({
    x: cx + (p.x - cx) * expandX,
    y: cy + (p.y - cy) * expandY,
  }));
  return convexHull(expanded);
}

function drawSoftPolygonRegion(hull) {
  if (!hull || hull.length < 3) {
    return;
  }

  let cx = 0;
  let cy = 0;
  for (const p of hull) {
    cx += p.x;
    cy += p.y;
  }
  cx /= hull.length;
  cy /= hull.length;

  const drawPath = () => {
    maskCtx.beginPath();
    maskCtx.moveTo(hull[0].x, hull[0].y);
    for (let i = 1; i < hull.length; i += 1) {
      maskCtx.lineTo(hull[i].x, hull[i].y);
    }
    maskCtx.closePath();
  };

  // Opaque core (sharp content area).
  maskCtx.fillStyle = '#fff';
  drawPath();
  maskCtx.fill();

  // Feather only the edge by layering outward-expanded hulls with alpha falloff.
  const featherPx = Math.max(0, Math.min(maskBlurSetting, 160));
  if (featherPx < 1) {
    return;
  }
  const passes = Math.max(4, Math.round(featherPx / 2));

  for (let i = passes; i >= 1; i -= 1) {
    const t = i / passes; // 1 -> outer edge, 0 -> near core
    const grow = t * featherPx;
    const alpha = 0.02 + (1 - t) * 0.14;

    maskCtx.fillStyle = `rgba(255,255,255,${alpha})`;
    maskCtx.beginPath();
    for (let k = 0; k < hull.length; k += 1) {
      const p = hull[k];
      const vx = p.x - cx;
      const vy = p.y - cy;
      const len = Math.hypot(vx, vy) || 1;
      const ex = p.x + (vx / len) * grow;
      const ey = p.y + (vy / len) * grow;
      if (k === 0) {
        maskCtx.moveTo(ex, ey);
      } else {
        maskCtx.lineTo(ex, ey);
      }
    }
    maskCtx.closePath();
    maskCtx.fill();
  }
}

function buildSoftMask(dx, dy, drawW, drawH, cw, ch) {
  maskCtx.clearRect(0, 0, cw, ch);

  for (const landmarks of latestFaces) {
    const leftHull = getExpandedHull(
      landmarks,
      [...LEFT_EYE_INDICES, ...LEFT_BROW_INDICES],
      dx,
      dy,
      drawW,
      drawH,
      maskSizeSetting,
    );
    const rightHull = getExpandedHull(
      landmarks,
      [...RIGHT_EYE_INDICES, ...RIGHT_BROW_INDICES],
      dx,
      dy,
      drawW,
      drawH,
      maskSizeSetting,
    );

    drawSoftPolygonRegion(leftHull);
    drawSoftPolygonRegion(rightHull);
  }
}

function drawPreThresholdFrame(dx, dy, drawW, drawH, cw, ch) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);

  trimHeardLines(cw, ch, Boolean(interimHeard));
  drawTranscriptLayer(cw, ch);
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.drawImage(textCanvas, 0, 0);
  ctx.restore();

  if (latestFaces.length === 0) {
    return;
  }

  videoLayerCtx.clearRect(0, 0, cw, ch);
  // Pump contrast/brightness inside the preserved eye+brow region before thresholding.
  videoLayerCtx.filter = 'contrast(1.45) brightness(1.22)';
  videoLayerCtx.drawImage(sourceVideo, dx, dy, drawW, drawH);
  videoLayerCtx.filter = 'none';

  buildSoftMask(dx, dy, drawW, drawH, cw, ch);

  videoLayerCtx.save();
  videoLayerCtx.globalCompositeOperation = 'destination-in';
  videoLayerCtx.drawImage(maskCanvas, 0, 0);
  videoLayerCtx.restore();

  // Eyes layer is drawn on top of text so text sits "under" floating eyes.
  ctx.drawImage(videoLayerCanvas, 0, 0);
}

function computeThresholdValue() {
  const sliderNorm = thresholdSetting / 255;
  // Pure manual threshold (no auto-adaptation), with brighter low-end response.
  return Math.round(Math.pow(sliderNorm, 1.6) * 255);
}

function applyThresholdColorization(cw, ch) {
  const frame = ctx.getImageData(0, 0, cw, ch);
  const px = frame.data;
  const thresholdValue = computeThresholdValue();

  for (let i = 0; i < px.length; i += 4) {
    const luma = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const useLight = luma >= thresholdValue;
    const color = useLight ? lightColor : darkColor;
    px[i] = color[0];
    px[i + 1] = color[1];
    px[i + 2] = color[2];
  }

  ctx.putImageData(frame, 0, 0);
}

function drawFrame() {
  if (sourceVideo.paused || sourceVideo.ended) {
    animationId = requestAnimationFrame(drawFrame);
    return;
  }

  const vw = sourceVideo.videoWidth;
  const vh = sourceVideo.videoHeight;
  const cw = canvas.width;
  const ch = canvas.height;

  requestFaceMesh();
  updateAudioFeatures();

  const scale = cw / vw;
  const drawW = cw;
  const drawH = Math.floor(vh * scale);
  const dx = 0;
  const dy = Math.floor((ch - drawH) / 2);

  drawPreThresholdFrame(dx, dy, drawW, drawH, cw, ch);
  applyThresholdColorization(cw, ch);

  animationId = requestAnimationFrame(drawFrame);
}

function startRenderLoop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  animationId = requestAnimationFrame(drawFrame);
}

function stopExistingStream() {
  if (!mediaStream) {
    stopAudioAnalysis();
    return;
  }
  mediaStream.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  stopAudioAnalysis();
}

async function startWebcam() {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.error('Webcam API unavailable in this browser.');
    return;
  }

  stopExistingStream();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
      },
      audio: false,
    });
    sourceVideo.srcObject = mediaStream;
    await sourceVideo.play();
    startRenderLoop();
  } catch (error) {
    console.error('Webcam access blocked:', error);
  }
}

function toggleThresholdHud() {
  thresholdHud.classList.toggle('show');
  thresholdHud.setAttribute('aria-hidden', String(!thresholdHud.classList.contains('show')));
}

window.addEventListener('beforeunload', stopExistingStream);
window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return;
  }
  if (event.key === 'o' || event.key === 'O') {
    toggleThresholdHud();
    return;
  }
  if (event.key === 'v' || event.key === 'V') {
    toggleColorMode('v');
    return;
  }
  if (event.key === 'h' || event.key === 'H') {
    toggleColorMode('h');
    return;
  }
  if (event.key === 's' || event.key === 'S') {
    toggleColorMode('s');
    return;
  }
  if (event.key === 'c' || event.key === 'C') {
    toggleColorMode('c');
  }
});

thresholdSlider.addEventListener('input', () => {
  thresholdSetting = Number(thresholdSlider.value);
  thresholdValueEl.textContent = String(thresholdSetting);
});

maskSizeSlider.addEventListener('input', () => {
  maskSizeSetting = Number(maskSizeSlider.value);
  maskSizeValueEl.textContent = String(maskSizeSetting);
});

maskBlurSlider.addEventListener('input', () => {
  maskBlurSetting = Number(maskBlurSlider.value);
  maskBlurValueEl.textContent = String(maskBlurSetting);
});

initFaceMesh();
initRandomColors();
resizeCanvas();
startWebcam();
initSpeechRecognition();
startAudioAnalysis();
