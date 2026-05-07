/**
 * Decompressor.ts
 * Handles LZMA, ZSTD decompression in pure JS/WASM.
 * LZHAM has no public JS/WASM implementation — throws a clear error.
 */
import type { Compression } from './ScParser';

// ── LZMA ─────────────────────────────────────────────────────────────────────
// lzma-js is a pure-JS implementation that works in React Native / Expo.
// The SC LZMA stream starts at offset 9 (skipping the 9-byte LZMA header
// that some encoders prepend), but the standard lzma-js handles it correctly
// when given the full compressed buffer.
async function decompressLZMA(data: Uint8Array): Promise<Uint8Array> {
  try {
    // Dynamic import so the bundle only loads this when needed
    const LZMA = await import('lzma-js');
    return new Promise((resolve, reject) => {
      LZMA.decompress(data, (result: number[] | Uint8Array, error: Error | null) => {
        if (error) reject(new Error(`LZMA decompress failed: ${error.message}`));
        else resolve(result instanceof Uint8Array ? result : new Uint8Array(result));
      });
    });
  } catch (e: any) {
    throw new Error(`LZMA decompression error: ${e.message}`);
  }
}

// ── ZSTD ─────────────────────────────────────────────────────────────────────
// fzstd is a WASM-based ZSTD decoder compiled to JS — works in RN/Expo.
async function decompressZSTD(data: Uint8Array): Promise<Uint8Array> {
  try {
    const { decompress } = await import('fzstd');
    return decompress(data);
  } catch (e: any) {
    throw new Error(`ZSTD decompression error: ${e.message}`);
  }
}

// ── LZHAM ─────────────────────────────────────────────────────────────────────
// No public JS/WASM implementation exists for LZHAM (Valve's proprietary codec).
// Files compressed with LZHAM must be manually decompressed on PC first.
async function decompressLZHAM(_data: Uint8Array): Promise<Uint8Array> {
  throw new Error(
    'LZHAM compression is not supported in the JS runtime.\n\n' +
    'To open this file:\n' +
    '1. Use the desktop SC Editor to re-save it with ZSTD or no compression, OR\n' +
    '2. Use sc-compression CLI: sc-compression -d file.sc'
  );
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function decompress(
  data: Uint8Array,
  compression: Compression
): Promise<Uint8Array> {
  switch (compression) {
    case 'NONE':  return data;
    case 'LZMA':  return decompressLZMA(data);
    case 'ZSTD':  return decompressZSTD(data);
    case 'LZHAM': return decompressLZHAM(data);
    default:      return data;
  }
}
