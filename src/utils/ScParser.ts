import { Buffer } from 'buffer';

export type Compression = 'LZHAM' | 'LZMA' | 'ZSTD' | 'NONE';
export type PixelFormat = 'RGBA8888' | 'RGB565' | 'RGBA4444' | 'LA88' | 'L8';

export interface ScTexture {
  index: number;
  width: number;
  height: number;
  pixelFormat: PixelFormat;
  dataSize: number; // bytes
}

export interface ShapeChunk {
  id: number;
  textureIndex: number;
  vertexCount: number;
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
  color: number;
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

// ─── Tag IDs ───────────────────────────────────────────────────────────────
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

class BufReader {
  private pos = 0;
  constructor(private buf: Buffer) {}

  get remaining() { return this.buf.length - this.pos; }
  get position()  { return this.pos; }

  u8()  { return this.buf.readUInt8(this.pos++); }
  i8()  { return this.buf.readInt8(this.pos++); }
  u16() { const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
  i16() { const v = this.buf.readInt16LE(this.pos); this.pos += 2; return v; }
  u32() { const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  i32() { const v = this.buf.readInt32LE(this.pos); this.pos += 4; return v; }
  bytes(n: number) { const s = this.buf.slice(this.pos, this.pos + n); this.pos += n; return s; }
  str(len: number) { return this.bytes(len).toString('utf8'); }
}

function pixelFormatFromType(t: number): PixelFormat {
  switch (t) {
    case 0:  return 'RGBA8888';
    case 2:  return 'RGBA4444';
    case 4:  return 'RGB565';
    case 6:  return 'LA88';
    case 10: return 'L8';
    default: return 'RGBA8888';
  }
}

function pixelBytes(fmt: PixelFormat): number {
  switch (fmt) {
    case 'RGBA8888': return 4;
    case 'RGBA4444': case 'RGB565': case 'LA88': return 2;
    case 'L8': return 1;
  }
}

/**
 * Parse an uncompressed SC payload (after decompression).
 * NOTE: LZMA/ZSTD/LZHAM decompression must be handled before calling this.
 * For the JS port we parse only the header + tag structure metadata;
 * raw pixel data is skipped (dataSize stored, not loaded into memory).
 */
export function parseScBuffer(fileBytes: Uint8Array, filePath: string): ScFile {
  const buf = Buffer.from(fileBytes);
  const r = new BufReader(buf);

  // Header
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

  // For NONE compression, payload follows directly
  if (compression !== 'NONE') {
    return {
      path: filePath,
      version,
      compression,
      exports: [],
      movieclips: [],
      shapes: [],
      textures: [],
      matrices: [],
      colorSpaces: [],
      textFields: [],
    };
  }

  // Parse tags
  const exports:     Export[]      = [];
  const movieclips:  Movieclip[]   = [];
  const shapes:      Shape[]       = [];
  const textures:    ScTexture[]   = [];
  const matrices:    Matrix[]      = [];
  const colorSpaces: ColorSpace[]  = [];
  const textFields:  TextField[]   = [];

  while (r.remaining > 0) {
    const tagId = r.u8();
    if (tagId === TAG_EOF) break;
    const blockLen = r.u32();
    if (blockLen < 0 || blockLen > r.remaining) break;
    const block = r.bytes(blockLen);
    const b = new BufReader(block);

    try {
      switch (tagId) {
        case TAG_TEXTURE: {
          const type   = b.u8();
          const width  = b.u16();
          const height = b.u16();
          const fmt    = pixelFormatFromType(type);
          const size   = width * height * pixelBytes(fmt);
          textures.push({ index: textures.length, width, height, pixelFormat: fmt, dataSize: size });
          break;
        }
        case TAG_SHAPE:
        case TAG_SHAPE_V2: {
          const id = b.u16();
          if (b.remaining >= 2) b.u16(); // chunk count
          shapes.push({ id, chunks: [] });
          break;
        }
        case TAG_SHAPE_CHUNK: {
          const id         = b.u16();
          const texIndex   = b.u8();
          const count      = b.u8();
          shapes[shapes.length - 1]?.chunks.push({ id, textureIndex: texIndex, vertexCount: count });
          break;
        }
        case TAG_MOVIECLIP:
        case TAG_MOVIECLIP_V2: {
          const id  = b.u16();
          const fps = b.u8();
          movieclips.push({ id, fps, frames: [] });
          break;
        }
        case TAG_MOVIECLIP_FRAME: {
          const nameLen = b.u16();
          const name    = b.str(nameLen);
          const elemCount = b.u16();
          const elements: FrameElement[] = [];
          for (let i = 0; i < elemCount; i++) {
            elements.push({ shapeId: b.u16(), matrixIndex: b.u16(), colorSpaceIndex: b.u16() });
          }
          movieclips[movieclips.length - 1]?.frames.push({ name, elements });
          break;
        }
        case TAG_MATRIX: {
          const id = matrices.length;
          const a = b.i32() / 1024; const bv = b.i32() / 1024;
          const c = b.i32() / 1024; const d  = b.i32() / 1024;
          const tx = b.i32() / 20;  const ty  = b.i32() / 20;
          matrices.push({ id, a, b: bv, c, d, tx, ty });
          break;
        }
        case TAG_COLOR_SPACE: {
          const id = colorSpaces.length;
          colorSpaces.push({
            id,
            rMul: b.u8(), gMul: b.u8(), bMul: b.u8(), aMul: b.u8(),
            rAdd: b.u8(), gAdd: b.u8(), bAdd: b.u8(), aAdd: b.u8(),
          });
          break;
        }
        case TAG_EXPORT: {
          const count = b.u16();
          const mcIds = Array.from({ length: count }, () => b.u16());
          for (let i = 0; i < count; i++) {
            const nameLen = b.u16();
            const name    = b.str(nameLen);
            exports.push({ id: i, name, movieclipId: mcIds[i] });
          }
          break;
        }
        case TAG_TEXTFIELD: {
          const id       = b.u16();
          const textLen  = b.u16(); const text     = b.str(textLen);
          const fontLen  = b.u16(); const fontName = b.str(fontLen);
          const fontSize = b.u16();
          const color    = b.u32();
          const flags    = b.u8();
          textFields.push({ id, text, fontName, fontSize, color,
            bold: (flags & 0x01) !== 0, italic: (flags & 0x02) !== 0 });
          break;
        }
      }
    } catch (_) { /* skip malformed blocks */ }
  }

  return { path: filePath, version, compression, exports, movieclips, shapes, textures, matrices, colorSpaces, textFields };
}
