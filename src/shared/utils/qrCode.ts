/**
 * Lightweight Standalone QR Code Generator (SVG & Matrix)
 * Implements ISO/IEC 18004 standard QR Code (Byte mode, Error Correction Level M/L)
 * Completely dependency-free and offline.
 */

// GF(256) arithmetic for Reed-Solomon error correction
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
})();

function gmult(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

function rsGenPoly(n: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < n; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gmult(poly[j], EXP_TABLE[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: Uint8Array, eccCount: number): Uint8Array {
  const gen = rsGenPoly(eccCount);
  const remainder = new Uint8Array(eccCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[eccCount - 1] = 0;
    for (let j = 0; j < eccCount; j++) {
      remainder[j] ^= gmult(gen[j], factor);
    }
  }
  return remainder;
}

// Version specifications (capacity and ECC block lengths for byte mode, EC Level M)
// Version 1: 21x21, Version 2: 25x25, Version 3: 29x29, Version 4: 33x33, Version 5: 37x37, Version 6: 41x41
interface IQrVersionInfo {
  version: number;
  size: number;
  totalBytes: number;
  dataBytes: number;
  eccBytes: number;
  alignPos: number[];
}

const VERSIONS: IQrVersionInfo[] = [
  { version: 1, size: 21, totalBytes: 26, dataBytes: 16, eccBytes: 10, alignPos: [] },
  { version: 2, size: 25, totalBytes: 44, dataBytes: 28, eccBytes: 16, alignPos: [6, 18] },
  { version: 3, size: 29, totalBytes: 70, dataBytes: 44, eccBytes: 26, alignPos: [6, 22] },
  { version: 4, size: 33, totalBytes: 100, dataBytes: 64, eccBytes: 36, alignPos: [6, 26] },
  { version: 5, size: 37, totalBytes: 134, dataBytes: 86, eccBytes: 48, alignPos: [6, 30] },
  { version: 6, size: 41, totalBytes: 172, dataBytes: 108, eccBytes: 64, alignPos: [6, 34] },
  { version: 7, size: 45, totalBytes: 196, dataBytes: 124, eccBytes: 72, alignPos: [6, 22, 38] },
  { version: 8, size: 49, totalBytes: 242, dataBytes: 154, eccBytes: 88, alignPos: [6, 24, 42] }
];

export function generateQrMatrix(text: string): boolean[][] {
  const utf8 = new TextEncoder().encode(text);
  const dataLen = utf8.length;

  // Find smallest version that fits data (header = 4 bits mode + 8 bits count = 12 bits -> 2 bytes)
  const vInfo = VERSIONS.find(v => v.dataBytes >= dataLen + 3) || VERSIONS[VERSIONS.length - 1];
  const size = vInfo.size;

  // 1. Bitstream packing (Byte mode 0100)
  const bitstream: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bitstream.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode
  pushBits(dataLen, 8); // Character count
  for (let i = 0; i < dataLen; i++) {
    pushBits(utf8[i], 8);
  }

  // Terminator
  const maxBits = vInfo.dataBytes * 8;
  const termLen = Math.min(4, maxBits - bitstream.length);
  pushBits(0, termLen);

  // Pad to byte boundary
  while (bitstream.length % 8 !== 0) {
    bitstream.push(0);
  }

  // Pad bytes 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bitstream.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to bytes
  const dataBytes = new Uint8Array(vInfo.dataBytes);
  for (let i = 0; i < vInfo.dataBytes; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bitstream[i * 8 + b];
    }
    dataBytes[i] = byteVal;
  }

  // Reed-Solomon ECC calculation
  const eccBytes = rsEncode(dataBytes, vInfo.eccBytes);

  // Combined codeword buffer
  const finalCodewords = new Uint8Array(vInfo.totalBytes);
  finalCodewords.set(dataBytes, 0);
  finalCodewords.set(eccBytes, dataBytes.length);

  // 2. Matrix allocation
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  // Helper to place finder pattern
  function placeFinder(startX: number, startY: number) {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const px = startX + x;
        const py = startY + y;
        if (px >= 0 && px < size && py >= 0 && py < size) {
          const isBorder = x === -1 || x === 7 || y === -1 || y === 7;
          const isInnerRing = (x === 1 || x === 5) && y >= 1 && y <= 5 || (y === 1 || y === 5) && x >= 1 && x <= 5;
          if (isBorder || isInnerRing) {
            matrix[py][px] = false;
          } else {
            matrix[py][px] = true;
          }
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(size - 7, 0);
  placeFinder(0, size - 7);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[4 * vInfo.version + 9][8] = true;

  // Alignment patterns
  for (const ay of vInfo.alignPos) {
    for (const ax of vInfo.alignPos) {
      if (matrix[ay][ax] !== null) continue; // Skip finder overlaps
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const isCenter = dx === 0 && dy === 0;
          const isEdge = Math.abs(dx) === 2 || Math.abs(dy) === 2;
          matrix[ay + dy][ax + dx] = isCenter || isEdge;
        }
      }
    }
  }

  // Format info mask placeholders
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }

  // 3. Data placement (zigzag right-to-left)
  const allBits: number[] = [];
  for (let i = 0; i < finalCodewords.length; i++) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((finalCodewords[i] >> b) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upwards
      ? Array.from({ length: size }, (_, idx) => size - 1 - idx)
      : Array.from({ length: size }, (_, idx) => idx);

    for (const y of rows) {
      for (const colOffset of [0, 1]) {
        const x = right - colOffset;
        if (matrix[y][x] === null) {
          const dataBit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          // Apply standard mask pattern 000: (x + y) % 2 === 0
          const maskBit = (x + y) % 2 === 0 ? 1 : 0;
          matrix[y][x] = (dataBit ^ maskBit) === 1;
        }
      }
    }
    upwards = !upwards;
  }

  // Format Information: EC Level M (00) + Mask 000 (000) = 00000 -> XOR with 101010000010010 = 101010000010010
  const formatInfo = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  // Top-left
  matrix[8][0] = Boolean(formatInfo[0]);
  matrix[8][1] = Boolean(formatInfo[1]);
  matrix[8][2] = Boolean(formatInfo[2]);
  matrix[8][3] = Boolean(formatInfo[3]);
  matrix[8][4] = Boolean(formatInfo[4]);
  matrix[8][5] = Boolean(formatInfo[5]);
  matrix[8][7] = Boolean(formatInfo[6]);
  matrix[8][8] = Boolean(formatInfo[7]);
  matrix[7][8] = Boolean(formatInfo[8]);
  matrix[5][8] = Boolean(formatInfo[9]);
  matrix[4][8] = Boolean(formatInfo[10]);
  matrix[3][8] = Boolean(formatInfo[11]);
  matrix[2][8] = Boolean(formatInfo[12]);
  matrix[1][8] = Boolean(formatInfo[13]);
  matrix[0][8] = Boolean(formatInfo[14]);

  // Bottom-left / Top-right mirrors
  for (let i = 0; i < 7; i++) {
    matrix[size - 1 - i][8] = Boolean(formatInfo[i]);
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][size - 8 + i] = Boolean(formatInfo[7 + i]);
  }

  return matrix.map(row => row.map(cell => Boolean(cell)));
}

/**
 * Generate a clean standalone SVG string representing the QR code
 */
export function generateQrSvg(text: string, sizePx = 256, margin = 2): string {
  const matrix = generateQrMatrix(text);
  const n = matrix.length;
  const totalCells = n + margin * 2;
  const cellSize = sizePx / totalCells;

  let paths = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix[y][x]) {
        const px = (x + margin) * cellSize;
        const py = (y + margin) * cellSize;
        paths += `M${px.toFixed(1)},${py.toFixed(1)}h${cellSize.toFixed(1)}v${cellSize.toFixed(1)}h-${cellSize.toFixed(1)}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">
    <rect width="100%" height="100%" fill="#ffffff" />
    <path d="${paths}" fill="#18201D" />
  </svg>`;
}
