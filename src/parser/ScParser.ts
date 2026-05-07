import { Buffer } from 'buffer';
import { decompress } from './Decompressor';

export type Compression = 'LZMA' | 'ZSTD' | 'LZHAM' | 'NONE';
export type PixelFormat = 'RGBA8888' | 'RGBA4444' | 'RGB565' | 'LA88' | 'L8';

export interface ScTexture {
  index: number;
  width: number;
  height: number;
  pixelFormat: PixelFormat;
  /** Raw pixel bytes (may be empty for large textures on low-memory devices) */
  data: Uint8Array;
}

export interface Vertex   { x: number; y: number; }
export interface UvCoord  { u: number; v: number; }

export interface ShapeChunk {
  id: number;
  textureIndex: number;
  vertices: Vertex[];
  uvCoords: UvCoord[];
}

export interface Shape {
  id: number;
  chunks: ShapeChunk[];
}

export interface FrameElement {
  shapeId: number;
  matrixIndex: number;
  colorSpaceIndex: number;
}

export interface MovieclipFrame {
  name: string;
  elements: FrameElement[];
}

export interface Movieclip {
  id: number;
  fps: number;
  frames: MovieclipFrame[];
}

export interface Export {
  id: number;
  name: string;
  movieclipId: number;
}

export interface Matrix {
  id: number;
  a: number; b: number;
  c: number; d: number;
  tx: number; ty: number;
}

export interface ColorSpace {
  id: number;
  rMul: number; gMul: number; bMul: number; aMul: number;
  rAdd: number; gAdd: number; bAdd: number; aAdd: number;
}

export interface TextField {
  id: number;
  text: string;
  fontName: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

export interface ScFile {
  path: string;
  version: number;
  compression: Compression;
  exports: Export[];
  movieclips: Movieclip[];
  shapes: Shape[];
  textures: ScTexture[];
  matrices: Matrix[];
  colorSpaces: ColorSpace[];
  textFields: TextField[];
}

// ─── Tag IDs ────────────────────────────────────────────────────────────────
const TAG_EOF             = 0;
const TAG_TEXTURE         = 1;
const TAG_SHAPE           = 2;
const TAG_MOVIECLIP       = 3;
const TAG_SHAPE_CHUNK     = 6;
const TAG_EXPORT          = 7;
const TAG_MATRIX          = 8;
const TAG_COLOR_SPACE     = 9;
const TAG_MOVIECLIP_FRAME = 11;
const TAG_MOVIECLIP_V2    = 12;
const TAG_TEXTFIELD       = 15;
const TAG_SHAPE_V2        = 18;

// ─── Binary reader ───────────────────────────────────────────────────────────
class Reader {
  private buf: Buffer;
  private pos = 0;

  constructor(data: Uint8Array) { this.buf = Buffer.from(data); }

  get remaining() { return this.buf.length - this.pos; }

  u8()  { return this.buf.readUInt8(this.pos++); }
  u16() { const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
  i32() { const v = this.buf.readInt32LE(this.pos);  this.pos += 4; return v; }
  u32() { const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }

  bytes(n: number): Uint8Array {
    const slice = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return new Uint8Array(slice);
  }

  str(): string {
    const len = this.u16();
    return Buffer.from(this.bytes(len)).toString('utf8');
  }

  sub(n: number): Reader { return new Reader(this.bytes(n)); }
}

// ─── Async parser (supports compressed files) ────────────────────────────────
export async function parseScFileAsync(data: Uint8Array, path: string): Promise<ScFile> {
  const r = new Reader(data);

  const magic = r.u16();
  if (magic !== 0x5343) throw new Error(`Invalid SC file (magic 0x${magic.toString(16)})`);

  const version = r.u16();
  if (version < 3 || version > 4) throw new Error(`Unsupported SC version: ${version}`);

  const compressionId = r.u32();
  const compression: Compression =
    compressionId === 0x04 ? 'LZHAM' :
    compressionId === 0x01 ? 'LZMA'  :
    compressionId === 0x28 ? 'ZSTD'  : 'NONE';

  if (version === 4) r.bytes(16); // skip MD5

  // Decompress payload
  const compressed = r.bytes(r.remaining);
  const payload    = compression === 'NONE'
    ? new Reader(compressed)
    : new Reader(await decompress(compressed, compression));

  return parseTags(payload, { path, version, compression });
}

// ─── Synchronous parser (NONE only, kept for backwards compat) ───────────────
export function parseScFile(data: Uint8Array, path: string): ScFile {
  const r = new Reader(data);

  const magic = r.u16();
  if (magic !== 0x5343) throw new Error(`Invalid SC file (magic 0x${magic.toString(16)})`);

  const version = r.u16();
  if (version < 3 || version > 4) throw new Error(`Unsupported SC version: ${version}`);

  const compressionId = r.u32();
  const compression: Compression =
    compressionId === 0x04 ? 'LZHAM' :
    compressionId === 0x01 ? 'LZMA'  :
    compressionId === 0x28 ? 'ZSTD'  : 'NONE';

  if (compression !== 'NONE') {
    throw new Error(
      `File uses ${compression} compression — use "Open (decompress)" to load it.`
    );
  }

  if (version === 4) r.bytes(16);
  const payload = r.sub(r.remaining);
  return parseTags(payload, { path, version, compression });
}

// ─── Tag-stream parser ───────────────────────────────────────────────────────
function parseTags(
  payload: Reader,
  meta: { path: string; version: number; compression: Compression }
): ScFile {
  const exports:     Export[]     = [];
  const movieclips:  Movieclip[]  = [];
  const shapes:      Shape[]      = [];
  const textures:    ScTexture[]  = [];
  const matrices:    Matrix[]     = [];
  const colorSpaces: ColorSpace[] = [];
  const textFields:  TextField[]  = [];

  while (payload.remaining > 0) {
    const tagId   = payload.u8();
    if (tagId === TAG_EOF) break;
    const blockLen = payload.i32();
    if (blockLen < 0 || blockLen > payload.remaining) break;
    const b = payload.sub(blockLen);

    switch (tagId) {
      case TAG_TEXTURE: {
        const type   = b.u8();
        const width  = b.u16();
        const height = b.u16();
        const fmt: PixelFormat =
          type === 2  ? 'RGBA4444' :
          type === 4  ? 'RGB565'   :
          type === 6  ? 'LA88'     :
          type === 10 ? 'L8'       : 'RGBA8888';
        const bpp  = fmt === 'RGBA8888' ? 4 : fmt === 'L8' ? 1 : 2;
        const size = width * height * bpp;
        // Read pixel data (may throw if file is truncated — caught upstream)
        const data = b.remaining >= size ? b.bytes(size) : new Uint8Array(size);
        textures.push({ index: textures.length, width, height, pixelFormat: fmt, data });
        break;
      }
      case TAG_SHAPE:
      case TAG_SHAPE_V2: {
        const id = b.u16();
        if (b.remaining >= 2) b.u16(); // chunk count hint
        shapes.push({ id, chunks: [] });
        break;
      }
      case TAG_SHAPE_CHUNK: {
        const id       = b.u16();
        const texIndex = b.u8();
        const count    = b.u8();
        const vertices: Vertex[]  = [];
        const uvCoords: UvCoord[] = [];
        for (let i = 0; i < count; i++) {
          vertices.push({ x: b.i32() / 20, y: b.i32() / 20 });
        }
        for (let i = 0; i < count; i++) {
          uvCoords.push({ u: b.u16() / 65535, v: b.u16() / 65535 });
        }
        shapes[shapes.length - 1]?.chunks.push({ id, textureIndex: texIndex, vertices, uvCoords });
        break;
      }
      case TAG_MOVIECLIP:
      case TAG_MOVIECLIP_V2: {
        movieclips.push({ id: b.u16(), fps: b.u8(), frames: [] });
        break;
      }
      case TAG_MOVIECLIP_FRAME: {
        const name     = b.str();
        const elemCount = b.u16();
        const elements: FrameElement[] = [];
        for (let i = 0; i < elemCount; i++) {
          elements.push({ shapeId: b.u16(), matrixIndex: b.u16(), colorSpaceIndex: b.u16() });
        }
        movieclips[movieclips.length - 1]?.frames.push({ name, elements });
        break;
      }
      case TAG_EXPORT: {
        const count = b.u16();
        const mcIds = Array.from({ length: count }, () => b.u16());
        for (let i = 0; i < count; i++) {
          const name = b.str();
          exports.push({ id: i, name, movieclipId: mcIds[i] });
        }
        break;
      }
      case TAG_MATRIX: {
        matrices.push({
          id: matrices.length,
          a: b.i32() / 1024, b: b.i32() / 1024,
          c: b.i32() / 1024, d: b.i32() / 1024,
          tx: b.i32() / 20,  ty: b.i32() / 20,
        });
        break;
      }
      case TAG_COLOR_SPACE: {
        colorSpaces.push({
          id: colorSpaces.length,
          rMul: b.u8(), gMul: b.u8(), bMul: b.u8(), aMul: b.u8(),
          rAdd: b.u8(), gAdd: b.u8(), bAdd: b.u8(), aAdd: b.u8(),
        });
        break;
      }
      case TAG_TEXTFIELD: {
        const id       = b.u16();
        const text     = b.str();
        const fontName = b.str();
        const fontSize = b.u16();
        b.i32(); // color
        const flags    = b.u8();
        textFields.push({ id, text, fontName, fontSize, bold: !!(flags & 1), italic: !!(flags & 2) });
        break;
      }
      // Unknown tags: already consumed by sub()
    }
  }

  return { ...meta, exports, movieclips, shapes, textures, matrices, colorSpaces, textFields };
}
