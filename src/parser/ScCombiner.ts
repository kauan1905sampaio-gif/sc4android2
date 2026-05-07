import type { ScFile, Export, Movieclip, Shape, Matrix, ColorSpace } from './ScParser';

export function combineScFiles(
  base: ScFile,
  source: ScFile,
  exportIds: number[]
): ScFile {
  const newExports     = [...base.exports];
  const newMovieclips  = [...base.movieclips];
  const newShapes      = [...base.shapes];
  const newTextures    = [...base.textures];
  const newMatrices    = [...base.matrices];
  const newColorSpaces = [...base.colorSpaces];

  const mcOffset      = (Math.max(0, ...base.movieclips.map(m => m.id))) + 1;
  const shapeOffset   = (Math.max(0, ...base.shapes.map(s => s.id))) + 1;
  const matrixOffset  = base.matrices.length;
  const csOffset      = base.colorSpaces.length;
  const texOffset     = base.textures.length;

  const srcExports = source.exports.filter(e => exportIds.includes(e.id));

  // collect all movieclip ids needed
  const mcIds = new Set<number>();
  srcExports.forEach(e => collectMcIds(e.movieclipId, source, mcIds));

  // collect shape ids
  const shapeIds = new Set<number>();
  mcIds.forEach(id => {
    source.movieclips.find(m => m.id === id)?.frames.forEach(f =>
      f.elements.forEach(el => shapeIds.add(el.shapeId))
    );
  });

  // textures
  const texMap = new Map<number, number>();
  source.textures.forEach((t, i) => {
    texMap.set(i, newTextures.length);
    newTextures.push({ ...t, index: newTextures.length });
  });

  // shapes
  const shapeMap = new Map<number, number>();
  shapeIds.forEach(srcId => {
    const s = source.shapes.find(s => s.id === srcId);
    if (!s) return;
    const newId = srcId + shapeOffset;
    shapeMap.set(srcId, newId);
    newShapes.push({
      id: newId,
      chunks: s.chunks.map(c => ({ ...c, textureIndex: texMap.get(c.textureIndex) ?? c.textureIndex }))
    });
  });

  // matrices
  const matrixMap = new Map<number, number>();
  source.matrices.forEach((m, i) => {
    matrixMap.set(i, newMatrices.length);
    newMatrices.push({ ...m, id: newMatrices.length });
  });

  // color spaces
  const csMap = new Map<number, number>();
  source.colorSpaces.forEach((cs, i) => {
    csMap.set(i, newColorSpaces.length);
    newColorSpaces.push({ ...cs, id: newColorSpaces.length });
  });

  // movieclips
  const mcMap = new Map<number, number>();
  mcIds.forEach(srcId => {
    const mc = source.movieclips.find(m => m.id === srcId);
    if (!mc) return;
    const newId = srcId + mcOffset;
    mcMap.set(srcId, newId);
    newMovieclips.push({
      id: newId,
      fps: mc.fps,
      frames: mc.frames.map(f => ({
        name: f.name,
        elements: f.elements.map(el => ({
          shapeId:         shapeMap.get(el.shapeId) ?? el.shapeId,
          matrixIndex:     matrixMap.get(el.matrixIndex) ?? el.matrixIndex,
          colorSpaceIndex: csMap.get(el.colorSpaceIndex) ?? el.colorSpaceIndex,
        }))
      }))
    });
  });

  // exports
  srcExports.forEach(e => {
    newExports.push({
      id:          e.id + mcOffset,
      name:        e.name,
      movieclipId: mcMap.get(e.movieclipId) ?? e.movieclipId,
    });
  });

  return { ...base, exports: newExports, movieclips: newMovieclips, shapes: newShapes, textures: newTextures, matrices: newMatrices, colorSpaces: newColorSpaces };
}

function collectMcIds(id: number, source: ScFile, out: Set<number>) {
  if (out.has(id)) return;
  out.add(id);
  source.movieclips.find(m => m.id === id)?.frames.forEach(f =>
    f.elements.forEach(el => {
      if (source.movieclips.some(m => m.id === el.shapeId))
        collectMcIds(el.shapeId, source, out);
    })
  );
}
