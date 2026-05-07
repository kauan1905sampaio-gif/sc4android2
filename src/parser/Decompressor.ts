import type { Compression } from './ScParser';

async function decompressLZMA(data: Uint8Array): Promise<Uint8Array> {
  try {
    const LZMA = await import('lzma');
    return new Promise((resolve, reject) => {
      LZMA.decompress(
        Array.from(data),
        (result: number[] | Uint8Array | string, error: any) => {
          if (error) {
            reject(new Error(`LZMA decompress failed: ${error}`));
          } else if (typeof result === 'string') {
            const enc = new TextEncoder();
            resolve(enc.encode(result));
          } else {
            resolve(result instanceof Uint8Array ? result : new Uint8Array(result));
          }
        }
      );
    });
  } catch (e: any) {
    throw new Error(`LZMA decompression error: ${e.message}`);
  }
}

async function decompressZSTD(data: Uint8Array): Promise<Uint8Array> {
  try {
    const { decompress } = await import('fzstd');
    return decompress(data);
  } catch (e: any) {
    throw new Error(`ZSTD decompression error: ${e.message}`);
  }
}

async function decompressLZHAM(_data: Uint8Array): Promise<Uint8Array> {
  throw new Error(
    'LZHAM não tem implementação JS disponível.\n\n' +
    'Para abrir este arquivo:\n' +
    '1. Use o SC Editor desktop para re-salvar com ZSTD ou sem compressão, OU\n' +
    '2. Use: sc-compression -d arquivo.sc'
  );
}

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
