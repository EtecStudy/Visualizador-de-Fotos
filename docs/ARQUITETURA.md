# Arquitetura do Lumina

Documento técnico para quem vai manter ou expandir o projeto. Complementa o [README](../README.md) e o [BIBLIOTECAS](BIBLIOTECAS.md).

---

## 1. Visão geral em camadas

```
┌─────────────────────────────────────────────────────────────────────┐
│  Electron main (main.ts)                                            │
│  janela · protocolo lumina:// · IPC (abrir/salvar/revelar) · menu    │
└───────────────▲─────────────────────────────────────────────────────┘
                │ contextBridge  (window.lumina)
┌───────────────┴─────────────────────────────────────────────────────┐
│  Renderer (React 19)                                                │
│  components/  ── lê e dispara ações ──▶  state/useAppStore (Zustand) │
│      │                                        │                     │
│      │ usa hooks (preview, histograma)        │ lê/escreve EditState│
│      ▼                                        ▼                     │
│  core/ (domínio puro, sem React)                                    │
│   image · editing · color · render · viewer · upscale · files       │
└─────────────────────────────────────────────────────────────────────┘
```

Regra de ouro: **`src/core` não importa React nem Electron**. Tudo que é regra de negócio (geometria, histórico, recorte, filtros, upscale, formatos) é código TypeScript puro e testável em Node.

---

## 2. Modelo de dados

```ts
PhotoAsset      // a foto original (nunca mutada pela edição)
  bitmap: ImageBitmap
  url, blob, mime, format, width, height, sizeBytes, path?

EditState       // a "receita" de edição — serializável
  rotation: 0 | 90 | 180 | 270
  straighten: -45..45      // graus
  crop: NormalizedRect|null // relativo aos limites já rotacionados
  adjustments: { brightness, contrast, saturation, sharpness, grayscale }
```

Consequências desse modelo:
- **Desfazer/refazer** = trocar o `EditState` atual (histórico linear em `state.past/future`).
- **Comparar antes/depois** = renderizar `EMPTY_EDIT` e o `EditState` atual.
- **Exportar** = `renderPhotoForExport(asset, edit)`.
- **Upscale** = renderizar em resolução total e passar o canvas para o motor de IA.

---

## 3. Pipeline de renderização (`core/render/photoRenderer.ts`)

```
        ┌──────────── 1. Geometria ────────────┐
bitmap ─▶ canvas de bounds = rotatedBounds(w,h, straighten) + troca p/ 90°
        │  ctx.translate(centro); ctx.rotate(straighten + rotation);      │
        │  ctx.drawImage(bitmap, -w/2, -h/2)                              │
        └─────────────────────────────────────┘
                        │
        ┌──────────── 2. Recorte ─────────────┐
        │ cropToPixels(edit.crop, bounds) → drawImage com source rect   │
        │ (no preview respeita a escala; no export é 1:1)               │
        └─────────────────────────────────────┘
                        │
        ┌──────────── 3. Cor ─────────────────┐
        │ applyColorPipeline(): WebGL (1 passe) │ fallback Canvas2D+CPU │
        └─────────────────────────────────────┘
                        │
                 canvas resultante
```

- `renderPhoto(asset, edit, { maxDimension, applyCrop })` → preview rápido (1600 px durante a interação, 3600 px depois de 220 ms).
- `renderPhotoForExport(asset, edit)` → resolução total, com limite de ~120 MP e erro explícito (`ImageTooLargeError`).
- `applyCrop: false` é usado no modo recorte, para o usuário ver a moldura inteira enquanto escolhe a área.

### Por que refazer do zero em vez de "aplicar em cima"?
Porque cada operação altera a imagem de forma irreversível (rotação + interpolação, nitidez, recorte). Renderizar do original garante:
1. qualidade máxima (uma única reamostragem no export);
2. undo/redo trivial;
3. possibilidade de mudar a ordem/valores de ajustes sem artefatos acumulados.

---

## 4. Filtros de cor

`core/color/`:
- `shaders.ts` — `VERTEX_SHADER` (quad full-screen) e `FRAGMENT_SHADER` (brilho aditivo, contraste em torno de 0.5, saturação via luminância Rec.709, grayscale e nitidez por diferença da média dos 4 vizinhos).
- `webglRenderer.ts` — `ColorGLRenderer`: um canvas WebGL + programa + textura reutilizados. Verifica `MAX_TEXTURE_SIZE` e devolve `null` quando não dá para usar GL.
- `colorPipeline.ts` — `applyColorPipeline()` decide GPU/CPU. Como o renderer tem **um único** canvas GL, o resultado é copiado (`copyCanvas`) antes de ser devolvido — preview, comparação e export podem coexistir.
- `filters.ts` — `unsharpMask()` (CPU, 5-tap, com clamp) e `cssFilterFor()` (fallback de cor).

---

## 5. Recorte

`core/editing/crop.ts` (puro):
- `ASPECT_PRESETS` (Livre, Original, 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3);
- `centeredRect`, `applyAspectToRect` (mantém o centro ao trocar de proporção);
- `resizeCropRect(rect, handle, dx, dy, bounds, aspect, minSize)` — alças N/S/E/W e cantos, com ancoragem no canto oposto e "shrink-to-fit" quando a proporção empurra a caixa para fora;
- `rectFromPoints` (arrastar para criar) e conversões normalizado ↔ pixel.

`components/CropOverlay.tsx` mapeia ponteiro → espaço da imagem dividindo pelo `scale` do preview (que é `fitScale * zoom`), então funciona em qualquer zoom. A máscara escura é feita com `box-shadow` de 9999/scale px — escala junto com a imagem.

---

## 6. Visualizador (zoom/pan)

- `ViewerStage` mede o palco com `ResizeObserver` e calcula `fitScale` (`fitScaleFactor`).
- `displayScale = fitScale * zoom`; a moldura recebe `translate3d(pan) scale(displayScale)`.
- Roda do mouse: `panForZoomAtPoint(pan, oldScale, newScale, cursor, stage)` mantém o ponto sob o cursor fixo.
- `clampPan` limita o deslocamento considerando o tamanho renderizado × palco.
- Duplo clique alterna ajustar ↔ 100%.

---

## 7. Upscale por IA

```
UpscaleEngine (core/upscale/types.ts)
  ├── EsrganEngine   TensorFlow.js + ESRGAN-Slim (2×/3×/4×) + cadeia de escalas
  └── LanczosEngine  reamostragem Lanczos 3 em CPU (TypeScript puro)
```

- `planScaleChain(n)` resolve a escala pedida com os modelos nativos (busca em largura; ex.: 8 → [4,2], 6 → [3,2], 16 → [4,2,2]).
- `EsrganEngine` carrega cada modelo **uma vez** (`tf.loadLayersModel` via UpscalerJS, apontando para `models/esrgan-slim/xN/model.json` no mesmo host) e reutiliza a instância.
- Cada passada recebe `patchSize` (64/128/256) e `padding` (≤8), com progresso agregado ponderado pelos pixels de saída.
- Cancelamento: `AbortController` → `upscaler.abort()`; erros específicos (`UpscaleUnsupportedError`, `UpscaleCancelledError`) para mensagens amigáveis.
- O resultado só existe na memória do diálogo: pode ser comparado, salvo como novo arquivo ou adicionado à biblioteca como um novo `PhotoAsset` (`origin: 'upscale'`).

---

## 8. Estado (Zustand) — `state/useAppStore.ts`

Fatias dentro de uma única store:
- **biblioteca**: `photos`, `activeId`, `editsByPhoto` (uma receita por foto);
- **editor**: `mode`, `past/future/lastCommit`, `cropActive/cropRect/cropAspectId`, `toolTab`, `compare`;
- **viewport**: `zoom`, `pan`, `stage`, `fitScale`, `gridVisible`, `loupeVisible`, `infoOpen`, `filmstripOpen`;
- **diálogos**: `saveOpen`, `upscaleOpen`, `shortcutsOpen`, `busy`, `toast`, preferências de upscale.

Detalhes importantes:
- `applyEdit()` normaliza, ignora no-ops e faz **coalescing** (slider arrastado em <800 ms com a mesma `key` = um passo de histórico).
- `setStageMetrics` é chamado pelo palco a cada resize.
- Fechar uma foto libera o `ImageBitmap` (`disposeAsset`) após 400 ms, para não fechar durante o unmount de um canvas.
- `notify()` centraliza toasts (info/sucesso/aviso/erro).

---

## 9. Camada de arquivos (portável)

```
FileService (core/types.ts)
  ├── DesktopFileService  → window.lumina (IPC): diálogo nativo, fs.writeFile, revelar na pasta
  └── BrowserFileService  → <input type=file> + <a download>
```

- `getFileService()` escolhe a implementação em runtime (basta existir `window.lumina`).
- O renderer **não tem Node**: só chamadas explícitas permitidas pelo `preload`.
- Arrastar-e-soltar usa `webUtils.getPathForFile()` (preload) para preservar o caminho real do arquivo no desktop.

---

## 10. Empacotamento e distribuição (CI)

O instalador é gerado no GitHub Actions (`.github/workflows/build-windows.yml`) em um runner `windows-latest`:

1. `npm ci` → `npm run typecheck` → `npm test` (falha o build se qualquer teste quebrar);
2. `npm run build` (renderer) e `electron:compile` (main/preload em `electron-dist/`);
3. `electron-builder --win nsis zip --x64` → instalador NSIS + ZIP portable;
4. **Smoke test**: o executável desempacotado é aberto no runner e deve continuar vivo por 25 s (detecta app que abre em branco/crash imediato);
5. artefatos publicados no run e o `.exe`/`.zip` anexados à Release `v<versão>`.

Configuração relevante em `package.json → build`:
- `directories.buildResources: assets` (ícone `assets/icon.ico` gerado a partir de `assets/icon.png`);
- `files`: `dist/`, `electron-dist/`, ícones e `package.json` — os pesos do modelo entram via `dist/models` (copiados de `public/`);
- `nsis.artifactName` para o instalador e `win.artifactName` para o zip;
- `fileAssociations` registra o app como visualizador de imagens no Windows.

## 11. Processo principal do Electron

- `protocol.registerSchemesAsPrivileged(['lumina'])` + `protocol.handle` servindo `dist/` com verificação de path traversal.
- **Contingência**: se o `lumina://` falhar em alguma máquina (`did-fail-load`), o app sobe um servidor estático em `127.0.0.1:<porta livre>` (`startFallbackServer`) e recarrega — evitando janela em branco; o servidor é fechado em `before-quit`.
- `registerIpc()`: `dialog:openImages`, `file:saveImage`, `shell:reveal`, `window:toggleFullscreen`, `app:version`, `files:pending`.
- **Instância única** (`requestSingleInstanceLock`) e `second-instance` → quando o usuário abre uma imagem por "Abrir com", a janela existente recebe o arquivo (`files:opened`).
- Menu da aplicação envia `menu:open|save|undo|redo|shortcuts` para o renderer.
- Dev: `LUMINA_DEV_URL` aponta para o Vite; produção: `lumina://app/index.html`.

---

## 12. Estilos

`src/styles/` com design tokens (`tokens.css`) e camadas separadas (`base`, `layout`, `components`, `editor`, `dialogs`, `responsive`). Tema escuro focado em fotografia: fundo quase preto, superfícies em camadas, acento âmbar (`#f5a524`) e tipografia Segoe UI Variable no Windows.

---

## 13. Testes e CI local

| Arquivo | O que garante |
| --- | --- |
| `editing/geometry.test.ts` | bounding box de rotação/endireitamento, crop↔pixels, fit, passos de zoom |
| `editing/crop.test.ts` | alças (cantos/laterais), proporção travada, limites, mínimo, proporções |
| `editing/history.test.ts` | undo/redo, descarte do futuro, limite de passos |
| `editing/defaults.test.ts` | normalização (clamp), igualdade profunda, flags "sujo" |
| `color/filters.test.ts` | unsharp mask em área plana/borda, limites 0–255 |
| `upscale/scaleChain.test.ts` | composição 2×–16× e rejeição de escalas inválidas |
| `upscale/lanczos.test.ts` | tamanhos exatos, cores sólidas, transparência |
| `image/format.test.ts` | extensões/mimes, bytes, nomes de export |
| `viewer/viewTransform.test.ts` | zoom ancorado no cursor, clamp de pan |
| `state/useAppStore.test.ts` | ações do editor, coalescing, crop, rotação, troca de foto |

Para adicionar testes de UI, o caminho natural é Playwright (o app roda em `npm run dev` no navegador).

---

## 14. Como adicionar uma ferramenta nova (checklist)

1. **Tipo**: adicione o campo em `EditState` (`core/types.ts`).
2. **Default/normalização**: `editing/defaults.ts` (`createDefaultEdit`, `normalizeEdit`, `isEditDirty`, `describeEdit`).
3. **Render**: implemente em `render/photoRenderer.ts` (Canvas2D) ou `color/shaders.ts` (GPU) — sempre a partir do original.
4. **Estado**: ação na store (`useAppStore`), com `key` para coalescing se for slider.
5. **UI**: painel em `components/panels/` + aba no `Inspector`.
6. **Atalhos**: `hooks/useKeyboardShortcuts.ts` e `ShortcutsDialog.tsx`.
7. **Testes**: nova matemática → arquivo `.test.ts` em `core/`.
8. **Docs**: atualize README (recursos) e este documento se mudar o modelo de dados.

---

## 15. Limitações conhecidas e próximos passos

- **Upscale em CPU** é lento em imagens grandes (o WebGL acelera muito). Roadmap: WebGPU + seleção automática de backend, indicador de backend ativo.
- **Modelos extras**: Real-ESRGAN para fotos reais, denoise (waifu2x-like), face restore — basta implementar `UpscaleEngine` e baixar o modelo para `public/models/` em um gerenciador de modelos.
- **Batch**: aplicar edição/upscale a várias fotos de uma vez (a store já mantém `editsByPhoto` por foto).
- **LUTs/curvas**: novo passo no pipeline de cor.
- **HEIC/TIFF**: depende de decodificador adicional (WASM).
- **Instalador sem assinatura**: o SmartScreen exibe um aviso na primeira execução; a solução definitiva é assinar o binário com um certificado de code signing (configurável por `CSC_LINK`/`CSC_KEY_PASSWORD` no workflow).
