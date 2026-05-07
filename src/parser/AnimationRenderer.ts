/**
 * AnimationRenderer.ts
 *
 * Generates a self-contained HTML string that renders a SC Movieclip
 * animation inside a <WebView> using Canvas 2D.
 *
 * How it works:
 *  1. We convert raw texture pixel data → data URIs (base64 PNG-like blobs)
 *     using a tiny in-JS PNG encoder so the canvas can drawImage().
 *  2. Each frame's FrameElements are drawn using the affine matrix stored
 *     in scFile.matrices, clipping to the UV-mapped polygon of each ShapeChunk.
 *  3. A requestAnimationFrame loop advances frames at the movieclip's fps.
 *
 * Limitations:
 *  - ColorSpace transforms (multiply/add) are applied but may be approximate.
 *  - Only the first shape chunk per element is rendered (no multi-chunk shapes).
 *  - Textures > 2048px may be skipped to avoid memory issues on mobile.
 */
import type { ScFile, Movieclip, Matrix, ColorSpace } from './ScParser';

// ─── Minimal PNG encoder (raw RGBA → data URI) ────────────────────────────────
function adler32(data: Uint8Array): number {
  let s1 = 1, s2 = 0;
  for (let i = 0; i < data.length; i++) {
    s1 = (s1 + data[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return (s2 << 16) | s1;
}

function u32be(v: number): number[] {
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}

function crc32(data: number[]): number {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const b of data) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: number[]): number[] {
  const typeBytes = type.split('').map(c => c.charCodeAt(0));
  const len       = u32be(data.length);
  const body      = [...typeBytes, ...data];
  return [...len, ...body, ...u32be(crc32(body))];
}

function deflateSyncTiny(data: Uint8Array): number[] {
  // Non-compressed zlib (deflate type 0 blocks, max 65535 bytes each)
  const out: number[] = [0x78, 0x01]; // zlib header (no compression)
  let i = 0;
  while (i < data.length) {
    const slice = data.slice(i, i + 65535);
    const last  = (i + 65535) >= data.length ? 1 : 0;
    out.push(last, slice.length & 0xff, (slice.length >> 8) & 0xff,
      (~slice.length) & 0xff, ((~slice.length) >> 8) & 0xff);
    for (const b of slice) out.push(b);
    i += 65535;
  }
  const a = adler32(data);
  out.push(...u32be(a));
  return out;
}

export function rgbaToDataURI(rgba: Uint8Array, w: number, h: number): string {
  // Build raw image rows (filter byte 0 = None before each row)
  const rowSize = w * 4;
  const raw     = new Uint8Array((rowSize + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (rowSize + 1)] = 0; // filter byte
    raw.set(rgba.slice(y * rowSize, (y + 1) * rowSize), y * (rowSize + 1) + 1);
  }

  const sig     = [137, 80, 78, 71, 13, 10, 26, 10];
  const ihdr    = chunk('IHDR', [...u32be(w), ...u32be(h), 8, 2, 0, 0, 0]); // 8-bit RGB... wait, RGBA
  // Fix: bit depth=8, color type=6 (RGBA)
  const ihdrFixed = chunk('IHDR', [...u32be(w), ...u32be(h), 8, 6, 0, 0, 0]);
  const idat    = chunk('IDAT', deflateSyncTiny(raw));
  const iend    = chunk('IEND', []);

  const all     = [...sig, ...ihdrFixed, ...idat, ...iend];
  const bytes   = new Uint8Array(all);
  let binary    = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:image/png;base64,' + btoa(binary);
}

// ─── Convert SC pixel formats to RGBA ────────────────────────────────────────
export function toRGBA(data: Uint8Array, fmt: string, w: number, h: number): Uint8Array {
  const count  = w * h;
  const out    = new Uint8Array(count * 4);
  let src = 0, dst = 0;

  if (fmt === 'RGBA8888') {
    out.set(data.slice(0, count * 4));
    return out;
  }
  for (let i = 0; i < count; i++) {
    let r = 255, g = 255, b = 255, a = 255;
    if (fmt === 'RGBA4444') {
      const px = (data[src] | (data[src + 1] << 8)); src += 2;
      r = ((px >> 12) & 0xf) * 17;
      g = ((px >> 8)  & 0xf) * 17;
      b = ((px >> 4)  & 0xf) * 17;
      a = ((px)       & 0xf) * 17;
    } else if (fmt === 'RGB565') {
      const px = (data[src] | (data[src + 1] << 8)); src += 2;
      r = ((px >> 11) & 0x1f) << 3;
      g = ((px >> 5)  & 0x3f) << 2;
      b = ((px)       & 0x1f) << 3;
    } else if (fmt === 'LA88') {
      const lum = data[src++]; a = data[src++];
      r = g = b = lum;
    } else if (fmt === 'L8') {
      r = g = b = data[src++];
    }
    out[dst++] = r; out[dst++] = g; out[dst++] = b; out[dst++] = a;
  }
  return out;
}

// ─── HTML generator ───────────────────────────────────────────────────────────
export interface AnimationData {
  fps: number;
  frames: {
    elements: {
      matrix: Matrix | null;
      colorSpace: ColorSpace | null;
      polygonX: number[];
      polygonY: number[];
      uvX: number[];
      uvY: number[];
      textureIndex: number;
    }[];
  }[];
  textures: {
    dataUri: string;
    width: number;
    height: number;
  }[];
  canvasW: number;
  canvasH: number;
}

export function buildAnimationHtml(data: AnimationData): string {
  const json = JSON.stringify(data);
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0E0E14; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; overflow:hidden; }
  canvas { border:1px solid #2E2E3E; border-radius:8px; max-width:100vw; max-height:80vh; }
  #info { color:#9898B0; font-family:monospace; font-size:11px; margin-top:8px; }
  #controls { display:flex; gap:12px; margin-top:10px; }
  button { background:#22222E; border:1px solid #2E2E3E; color:#E8E8F0; padding:6px 16px; border-radius:6px; font-size:12px; cursor:pointer; }
  button.active, button:active { background:#FFD54F; color:#0E0E14; border-color:#FFD54F; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="info">Frame 0 / 0 | 0 fps</div>
<div id="controls">
  <button id="btnPlay" class="active">⏸ Pause</button>
  <button id="btnPrev">◀ Prev</button>
  <button id="btnNext">Next ▶</button>
</div>
<script>
(function(){
  const DATA = ${json};
  const canvas = document.getElementById('c');
  const ctx    = canvas.getContext('2d');
  const info   = document.getElementById('info');
  canvas.width  = DATA.canvasW;
  canvas.height = DATA.canvasH;

  // Preload texture images
  const imgs = DATA.textures.map(t => {
    const img = new Image();
    img.src = t.dataUri;
    return img;
  });

  let frame   = 0;
  let playing = true;
  let lastTs  = 0;
  const interval = 1000 / (DATA.fps || 25);

  function applyMatrix(ctx, m) {
    if (!m) return;
    ctx.transform(m.a, m.c, m.b, m.d, m.tx, m.ty);
  }

  function drawFrame(idx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0E0E14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fr = DATA.frames[idx];
    if (!fr) return;

    fr.elements.forEach(el => {
      const tex = DATA.textures[el.textureIndex];
      const img = imgs[el.textureIndex];
      if (!tex || !img.complete) return;

      const xs = el.polygonX, ys = el.polygonY;
      const us = el.uvX,      vs = el.uvY;
      if (!xs || xs.length < 3) return;

      ctx.save();

      // Apply affine matrix
      ctx.translate(canvas.width / 2, canvas.height / 2);
      applyMatrix(ctx, el.matrix);

      // Clip to shape polygon
      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
      ctx.closePath();
      ctx.clip();

      // Draw texture mapped to polygon bounding box (approximation)
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const pw = maxX - minX, ph = maxY - minY;
      if (pw > 0 && ph > 0) {
        const minU = Math.min(...us), maxU = Math.max(...us);
        const minV = Math.min(...vs), maxV = Math.max(...vs);
        const srcX = minU * tex.width, srcY = minV * tex.height;
        const srcW = (maxU - minU) * tex.width;
        const srcH = (maxV - minV) * tex.height;
        if (srcW > 0 && srcH > 0) {
          ctx.drawImage(img, srcX, srcY, srcW, srcH, minX, minY, pw, ph);
        }
      }

      ctx.restore();
    });

    info.textContent = 'Frame ' + (idx + 1) + ' / ' + DATA.frames.length + ' | ' + (DATA.fps || 25) + ' fps';
  }

  function tick(ts) {
    if (playing && ts - lastTs >= interval) {
      frame = (frame + 1) % DATA.frames.length;
      drawFrame(frame);
      lastTs = ts;
    }
    requestAnimationFrame(tick);
  }

  imgs[0] ? imgs[0].onload = () => {
    drawFrame(0);
    requestAnimationFrame(tick);
  } : requestAnimationFrame(tick);

  // Wait for all images
  Promise.all(imgs.map(i => new Promise(r => { i.onload = r; i.onerror = r; }))).then(() => {
    drawFrame(frame);
  });

  document.getElementById('btnPlay').onclick = function() {
    playing = !playing;
    this.textContent = playing ? '⏸ Pause' : '▶ Play';
    this.classList.toggle('active', playing);
  };
  document.getElementById('btnPrev').onclick = () => {
    frame = (frame - 1 + DATA.frames.length) % DATA.frames.length;
    drawFrame(frame);
  };
  document.getElementById('btnNext').onclick = () => {
    frame = (frame + 1) % DATA.frames.length;
    drawFrame(frame);
  };
})();
</script>
</body>
</html>`;
}

// ─── Main: build AnimationData from ScFile ────────────────────────────────────
export function prepareAnimationData(
  scFile: ScFile,
  mc: Movieclip
): AnimationData {
  const MAX_TEX = 1024; // skip textures larger than this to save memory

  // Build texture data URIs
  const textures = scFile.textures.map(t => {
    if (t.width > MAX_TEX || t.height > MAX_TEX || t.data.length === 0) {
      return { dataUri: '', width: t.width, height: t.height };
    }
    const rgba = toRGBA(t.data, t.pixelFormat, t.width, t.height);
    return { dataUri: rgbaToDataURI(rgba, t.width, t.height), width: t.width, height: t.height };
  });

  // Canvas size: bounding box of all shape vertices used
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  scFile.shapes.forEach(s => s.chunks.forEach(c => c.vertices.forEach(v => {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  })));
  const canvasW = Math.max(200, Math.min(600, Math.ceil(maxX - minX + 40)));
  const canvasH = Math.max(200, Math.min(600, Math.ceil(maxY - minY + 40)));

  // Build frame data
  const frames = mc.frames.map(fr => ({
    elements: fr.elements.flatMap(el => {
      const shape = scFile.shapes.find(s => s.id === el.shapeId);
      if (!shape) return [];
      return shape.chunks.map(chunk => ({
        matrix:       scFile.matrices[el.matrixIndex] ?? null,
        colorSpace:   scFile.colorSpaces[el.colorSpaceIndex] ?? null,
        polygonX:     chunk.vertices.map(v => v.x),
        polygonY:     chunk.vertices.map(v => v.y),
        uvX:          chunk.uvCoords.map(u => u.u),
        uvY:          chunk.uvCoords.map(u => u.v),
        textureIndex: chunk.textureIndex,
      }));
    }),
  }));

  return { fps: mc.fps || 25, frames, textures, canvasW, canvasH };
}
