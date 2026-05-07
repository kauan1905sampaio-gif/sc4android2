# SC Editor – React Native (Expo)

Port do SC Editor para React Native + Expo com suporte a descompressão e preview de animação.

## Funcionalidades

| Feature | Status |
|---------|--------|
| LZMA descompressão | ✅ via `lzma-js` (puro JS) |
| ZSTD descompressão | ✅ via `fzstd` (WASM→JS) |
| LZHAM descompressão | ⚠️ Não tem implementação JS pública |
| Preview de animação | ✅ Canvas2D via WebView |
| View Exports/Shapes/Textures/Matrices | ✅ |
| Live edit (mover elementos) | ✅ D-pad + input manual |
| Combine SC files | ✅ merge com remapping de IDs |
| Clone de exports | ✅ |
| Add/remove frames | ✅ |
| Recentes ordenados | ✅ |

## Como gerar o APK (sem PC)

### Opção 1 – EAS Build (recomendado)
1. Conta grátis em [expo.dev](https://expo.dev)
2. Suba no GitHub, adicione o secret `EXPO_TOKEN`
3. GitHub Actions → Build APK → Run workflow
4. Baixe o `.apk` em expo.dev/builds

### Opção 2 – Testar sem compilar (Expo Go)
1. Instale **Expo Go** no celular
2. Abra terminal online (Codespaces/Gitpod): `npx expo start`
3. Escaneie o QR — roda na hora

## Estrutura

```
app/
  _layout.tsx    ← navegação raiz
  index.tsx      ← Home (abrir arquivo + recentes)
  viewer.tsx     ← Viewer (tabs: Exports, Shapes, Textures, Matrices, Info)
  editor.tsx     ← Editor (frames, elementos, mover posição)
  preview.tsx    ← Preview de animação (Canvas2D via WebView)
src/
  parser/
    ScParser.ts          ← parse binário SC (sync + async)
    Decompressor.ts      ← LZMA (lzma-js) + ZSTD (fzstd)
    AnimationRenderer.ts ← gera HTML Canvas2D com PNG encoder embutido
    ScCombiner.ts        ← combina dois arquivos SC
    ScStore.ts           ← store global em memória
  theme/index.ts
  components/
```

## Notas sobre LZHAM

LZHAM é um codec proprietário da Valve sem implementação pública em JS/WASM.
Para abrir arquivos LZHAM, descomprime no PC primeiro com:
```
sc-compression -d arquivo.sc
```
