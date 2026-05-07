# Tutorial: Como compilar o APK com EAS Build

## O que é EAS Build?
É o serviço de compilação na nuvem do Expo.
Você envia o código, eles compilam o APK e disponibilizam para download.
**Gratuito** para projetos pessoais (sem limite de builds).

---

## Passo 1 — Criar conta no Expo

1. Acesse **https://expo.dev** pelo celular ou PC
2. Clique em **Sign Up**
3. Crie a conta (pode usar Google ou GitHub)
4. Anote seu **nome de usuário** (vai precisar depois)

---

## Passo 2 — Criar repositório no GitHub

1. Acesse **https://github.com**
2. Clique em **+** → **New repository**
3. Nome: `sc-editor` (ou qualquer nome)
4. Deixe **Public** ou **Private** (ambos funcionam)
5. Clique em **Create repository**

---

## Passo 3 — Subir os arquivos no GitHub

Como o GitHub não aceita upload de pastas pelo celular,
use o método abaixo:

1. No repositório criado, clique em **uploading an existing file**
2. Extraia o zip `SCEditorRN.zip` no celular
   - Use o app **ZArchiver** ou **MT Manager**
3. Faça upload de **todos os arquivos** um por um
   *(ou use o app GitHub para celular — ele aceita múltiplos arquivos)*

### Arquivos obrigatórios para o EAS funcionar:
```
package.json
app.json
eas.json
babel.config.js
metro.config.js
tsconfig.json
app/_layout.tsx
app/index.tsx
app/viewer.tsx
app/editor.tsx
app/preview.tsx
src/parser/ScParser.ts
src/parser/Decompressor.ts
src/parser/AnimationRenderer.ts
src/parser/ScCombiner.ts
src/parser/ScStore.ts
src/theme/index.ts
src/components/Chip.tsx
src/components/Row.tsx
assets/icon.png
assets/adaptive-icon.png
assets/splash.png
```

---

## Passo 4 — Gerar o EXPO_TOKEN

1. Acesse **https://expo.dev/settings/access-tokens**
2. Clique em **Create token**
3. Nome: `github-actions` (ou qualquer nome)
4. Clique em **Create**
5. **Copie o token gerado** (aparece só uma vez!)

---

## Passo 5 — Adicionar o token no GitHub

1. No seu repositório GitHub, clique em **Settings**
2. No menu lateral: **Secrets and variables** → **Actions**
3. Clique em **New repository secret**
4. Nome: `EXPO_TOKEN`
5. Valor: cole o token que você copiou
6. Clique em **Add secret**

---

## Passo 6 — Rodar o build

### Opção A — Automático (via push)
O build roda sozinho toda vez que você fizer upload de um arquivo.

### Opção B — Manual
1. No repositório, clique em **Actions**
2. Clique em **Build APK via EAS**
3. Clique em **Run workflow** → **Run workflow**

---

## Passo 7 — Baixar o APK

O build demora entre **5 e 15 minutos**.

1. Acesse **https://expo.dev/builds**
2. Encontre o build com status ✅ **Finished**
3. Clique nele
4. Clique em **Download** para baixar o `.apk`
5. Instale no Android normalmente
   *(pode precisar habilitar "Fontes desconhecidas" nas configurações)*

---

## Problemas comuns

| Erro | Solução |
|------|---------|
| `EXPO_TOKEN not found` | Verifique o Passo 5 — o secret deve se chamar exatamente `EXPO_TOKEN` |
| `Project not found` | Adicione seu usuário no `app.json`: `"owner": "seu_usuario_expo"` |
| `Build failed: asset not found` | Certifique que os arquivos da pasta `assets/` foram enviados |
| `npm install failed` | Verifique se o `package.json` foi enviado corretamente |

---

## Dica: Vincular o projeto ao Expo

Se aparecer erro de projeto não encontrado, edite o `app.json`
e adicione seu usuário antes de subir no GitHub:

```json
{
  "expo": {
    "owner": "SEU_USUARIO_EXPO",
    ...
  }
}
```

Substitua `SEU_USUARIO_EXPO` pelo seu nome de usuário em expo.dev.
