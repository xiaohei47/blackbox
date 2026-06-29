/**
 * Minimal but correct MD5 implementation.
 * Reference: RFC 1321 algorithm description.
 */
function rotl(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function toBytes(str: string): number[] {
  const buf: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp < 0x80) {
      buf.push(cp);
    } else if (cp < 0x800) {
      buf.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0xd800 || cp >= 0xe000) {
      buf.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      i++;
      cp = 0x10000 + ((cp & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff);
      buf.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return buf;
}

export function md5(str: string): string {
  const msg = toBytes(str);
  const bitLen = msg.length * 8;
  const padded = msg.slice();
  padded.push(0x80);
  while (padded.length % 64 !== 56) padded.push(0);

  // Append length in bits as 64-bit little-endian
  padded.push(bitLen & 0xff);
  padded.push((bitLen >>> 8) & 0xff);
  padded.push((bitLen >>> 16) & 0xff);
  padded.push((bitLen >>> 24) & 0xff);
  padded.push(0, 0, 0, 0);

  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
    0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
    0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];

  const S = [
    [7, 12, 17, 22], [5, 9, 14, 20], [4, 11, 16, 23], [6, 10, 15, 21],
  ];

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476;

  for (let i = 0; i < padded.length; i += 64) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++) {
      w[j] =
        padded[i + j * 4] |
        (padded[i + j * 4 + 1] << 8) |
        (padded[i + j * 4 + 2] << 16) |
        (padded[i + j * 4 + 3] << 24);
    }

    let a = h0, b = h1, c = h2, d = h3;

    for (let r = 0; r < 64; r++) {
      let f: number, g: number;
      if (r < 16) { f = (b & c) | (~b & d); g = r; }
      else if (r < 32) { f = (d & b) | (~d & c); g = (5 * r + 1) % 16; }
      else if (r < 48) { f = b ^ c ^ d; g = (3 * r + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * r) % 16; }

      const round = Math.floor(r / 16);
      const shift = S[round][r % 4];
      const temp = d;
      d = c;
      c = b;
      b = (b + rotl(a + f + K[r] + w[g], shift)) >>> 0;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
  }

  const hex = (n: number) => {
    const bytes = [
      n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff,
    ];
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  return hex(h0) + hex(h1) + hex(h2) + hex(h3);
}
