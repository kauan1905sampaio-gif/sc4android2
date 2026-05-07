export type Compression = 'LZHAM' | 'LZMA' | 'ZSTD' | 'NONE';
export type PixelFormat = 'RGBA8888' | 'RGB565' | 'RGBA4444' | 'LA88' | 'L8';

export interface Vertex    { x: number; y: number }
export interface UvCoord   { u: number; v: number }

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

export interface ScTexture {
  index: number;
  width: number;
  height: number;
  pixelFormat: PixelFormat;
  data: Uint8Array;
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
