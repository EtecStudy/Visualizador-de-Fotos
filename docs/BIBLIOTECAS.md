# Bibliotecas e tecnologias — decisões e justificativas

Este documento explica **o que** cada parte do Lumina usa, **por que** essa escolha foi feita e **quais alternativas** foram avaliadas. Todas as bibliotecas são open source e o aplicativo funciona offline.

---

## 1. Aplicativo desktop (Windows)

**Escolha: Electron 38 + Vite + esbuild**

| Alternativa | Prós | Contras | Decisão |
| --- | --- | --- | --- |
| **Electron** | Chrome embarcado (WebGL, Canvas, WASM), diálogos nativos, menu, associação de arquivos, `file://`-like protocolo seguro, ecossistema maduro de empacotamento (electron-builder → instalador NSIS) | Instalador maior (~150 MB) e consumo de RAM maior | ✅ Escolhido |
| Tauri (Rust + WebView2) | Binário pequeno, usa o WebView2 do Windows | WebGL/driver depende do WebView2 do usuário; integração com TensorFlow.js mais frágil; build exige toolchain Rust | ❌ |
| WPF/WinUI + C# | Nativo, leve | Reescrever toda a UI de imagem; upscale em C# exigiria ONNX Runtime | ❌ |
| PWA no navegador | Zero instalação | Sem acesso transparente ao disco (salvar sempre como download), sem "abrir com" | ⚠️ mantido como modo alternativo |

**Por que Electron é adequado aqui:** o app depende fortemente de GPU (WebGL) e de processamento de imagem no cliente. Embarcar o Chromium garante um ambiente **previsível** em qualquer Windows 10/11, sem depender da versão do WebView2, e permite que o **mesmo código** rode no navegador (durante o desenvolvimento) e no desktop.

Detalhes de integração:
- `contextIsolation: true`, `sandbox: true`, sem `nodeIntegration`: o renderer só usa o que o `preload.ts` expõe via `contextBridge` (`window.lumina`).
- Protocolo próprio **`lumina://`** serve o build de `dist/` (com `standard/secure/supportFetchAPI`) — o que faz `fetch('/models/...')` e `<canvas>` funcionarem sem `file://` e sem servidor local.
- `session.webRequest.onHeadersReceived` injeta uma **CSP restritiva** (`default-src 'self'`), permitindo `data:`/`blob:` só para imagens.
- `electron-builder` gera o instalador NSIS x64 com ícone, atalhos e `fileAssociations` para jpg/jpeg/png/webp.

---

## 2. Interface

**Escolha: React 19 + TypeScript 5.9 + Zustand 5 + lucide-react + CSS próprio**

- **React**: a UI tem muitos estados interdependentes (modo edição, ferramenta ativa, seleção de recorte, zoom/pan, diálogos, histórico). Componentes declarativos + seletores evitam sincronização manual entre canvas e painéis.
- **TypeScript estrito** (`strict`, `noUnusedLocals`…): os contratos (`EditState`, `UpscaleEngine`, `FileService`) são a espinha dorsal da arquitetura e o compilador garante que nenhuma ferramenta esqueça um campo.
- **Zustand** em vez de Redux: uma store de ~40 ações com leitura direta (`useAppStore((s) => s.zoom)`) e **sem re-render** de quem não usa aquele campo. Também permite ler o estado fora do React (`useAppStore.getState()`) nos handlers de ponteiro — crucial para zoom/pan fluido.
- **lucide-react**: ícones SVG consistentes e tree-shakeable.
- **CSS próprio com design tokens** (em vez de Tailwind/MUI): um visual sob medida ("app de fotos" escuro), sem dependências pesadas e com controle total de detalhes como a máscara de recorte e o divisor de comparação.

---

## 3. Visualização das imagens

**Escolha: `<canvas>` 2D + `ImageBitmap` + transformações CSS**

- `createImageBitmap(blob, { imageOrientation: 'from-image' })` decodifica **fora da main thread** e já aplica a **orientação EXIF** (fotos de celular aparecem em pé desde o primeiro frame). Fallback: `<img>` + canvas para formatos/engines que não suportam.
- O canvas final é colocado numa moldura posicionada por `transform: translate3d(...) scale(...)`, com `will-change: transform`: **zoom e pan são resolvidos pela GPU do compositor**, sem redesenhar a imagem a cada movimento — é o que dá a sensação de fluidez de um visualizador nativo.
- `image-rendering` e `imageSmoothingQuality: 'high'` conforme o caso: suave ao reduzir, nítido na lupa.

**Alternativas:** `<img>` com `transform` (mais simples, mas sem controle de pixels, difícil de combinar com o pipeline de cor e com o recorte) e WebGL direto para o viewer (complexidade desnecessária: o zoom não precisa de shader).

---

## 4. Edição e filtros

**Escolha: shader WebGL próprio para cor + fallback Canvas2D/CPU**

- Um único passe de fragmento aplica, na GPU: **brilho, contraste, saturação, preto e branco e nitidez (unsharp mask de 5 amostras)**. O programa é compilado uma vez (`ColorGLRenderer`) e reutilizado.
- **Não** se usa `ctx.filter` como caminho principal porque a máscara de nitidez precisa de vizinhança de pixels — impossível com filtros CSS/Canvas puros.
- **Fallback**: `ctx.filter = brightness()/contrast()/saturate()/grayscale()` + `unsharpMask()` em CPU (`src/core/color/filters.ts`), ativado automaticamente quando WebGL não existe/estoura limites de textura (imagens maiores que `MAX_TEXTURE_SIZE`).
- A nitidez na GPU é sensível ao tamanho do preview (1 px de raio em textura reduzida = muito na imagem final), por isso o app oferece a **lupa 1:1** e renderiza em alta resolução antes de exportar — o resultado exportado é sempre calculado em resolução total.

**Alternativas:** CSS filters (limitados), WASM (necessário só para operações mais pesadas), bibliotecas de filtro prontas (não cobrem o requisito de nitidez + histórico não destrutivo com a mesma qualidade).

**Undo/redo** é um histórico linear puro (`core/editing/history.ts`), com agrupamento temporal de gestos de slider (um arrasto = um passo).

---

## 5. Recorte

**Escolha: implementação própria + `drawImage(source rect)`**

- O recorte é armazenado **normalizado (0–1)** em `EditState.crop`, sempre relativo aos limites da imagem já girada/endireitada (`editBounds`).
- Aplicado **uma única vez** no export, a partir do bitmap original (`drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh)`) — sem perda cumulativa de qualidade, ao contrário de "recortar o recorte".
- Overlay interativo próprio (`CropOverlay`): 8 alças + arraste interno + arrastar para criar, máscara escura, terços, leitura de tamanho em px, proporções fixas (`resizeCropRect` resolve a matemática com ancoragem no canto oposto e limites).
- Toda a matemática (`clampNormalizedRect`, `applyAspectToRect`, `centeredRect`) é pura e testada.

**Alternativas:** `react-easy-crop`/`react-image-crop` (não conversam com a nossa geometria de rotação/endireitamento e não suportam alças laterais + proporções do jeito necessário), Cropper.js (dependência extra, menos controle sobre o estado não destrutivo).

---

## 6. Zoom e navegação

**Escolha: matemática própria (`core/viewer/viewTransform.ts`)**

- Zoom com roda/trackpad: fator exponencial `exp(-deltaY * 0.0022)` (mais `ctrl` para zoom de pinça), **ancorado no ponto sob o cursor** (`panForZoomAtPoint`).
- Passos discretos para teclado (`ZOOM_STEPS`: 5%…800%, limite de 1600%).
- `clampPan` mantém a imagem alcançável (nunca "perde" a foto fora da tela).
- "Ajustar à tela" calcula `fitScale` a partir do tamanho real do palco (`ResizeObserver`); "100%" converte `fitScale` em zoom absoluto.

---

## 7. Upscale por IA (super-resolução local)

**Escolha: TensorFlow.js 4.11 + UpscalerJS 1.0 + modelo ESRGAN-Slim (RDN) embutido**

- **ESRGAN-Slim** é um modelo de super-resolução (família ESRGAN/RDN) distribuído em 2×, 3× e 4×, com ~900 KB de pesos por escala. Foi treinado para **reconstruir detalhes** (bordas, texturas, cabelo), não apenas interpolar pixels.
- **UpscalerJS** fornece o encanamento de inferência: divisão em *patches* com *padding*, conversão tensor↔imagem, progresso, cancelamento e aquecimento (`warmup`).
- **TensorFlow.js** executa a rede no **WebGL do próprio computador** (fallback CPU). Nenhuma imagem é enviada a servidor; os pesos são lidos de `public/models/esrgan-slim/...` (parte do pacote instalado).
- Nós implementamos a interface `UpscaleEngine`, a **cadeia de escalas** (`planScaleChain`: 6× = 3×·2×, 8× = 4×·2×, 16× = 4×·2×·2×) e a integração com a UI (progresso, comparar, salvar, adicionar à biblioteca).
- Segundo motor: **Lanczos 3** em TypeScript puro (CPU), para imagens gigantes ou quando se quer o resultado clássico. É um `UpscaleEngine` igual aos outros — trocar/estender é plug-and-play.

**Alternativas avaliadas**

| Opção | Situação |
| --- | --- |
| **Waifu2x (ncnn/Vulkan nativo)** | Excelente e rápido, mas exigiria binário externo/GPU nativa e integração por processo; o modelo teria de ser baixado ou embutido sem licença clara. |
| **Real-ESRGAN via ONNX Runtime Web (WASM/WebGPU)** | Ótima qualidade; modelos de 60–70 MB, WebGPU ainda irregular no Windows/Electron. Caminho natural para uma versão futura ("Modelos extras"). |
| **`@tensorflow-models`/upscalers em CDN** | Violaria o requisito de funcionamento offline; por isso os pesos são empacotados. |
| **Upscaling bilinear/bicúbico** | Não reconstrói detalhes — exatamente o que o requisito pede para evitar. Ficou apenas como Lanczos opcional. |
| **API de nuvem** | Enviaria as fotos para servidores — descartado pelo requisito de privacidade. |

**Limites e segurança de memória:**
- IA: até ~80 MP de saída; Lanczos: 24 MP. O diálogo avisa antes de começar e desabilita escalas inviáveis.
- Processamento em blocos (patch 64/128/256) para não estourar a memória da GPU.
- Cancelamento cooperativo via `AbortController` + `upscaler.abort()`.

**Licenças:** `@upscalerjs/esrgan-slim` e `upscaler` são MIT (copyright © Kevin Scott); TensorFlow.js é Apache 2.0. A licença do modelo é copiada junto dos pesos (`public/models/esrgan-slim/LICENSE`).

---

## 8. Salvamento e exportação

**Escolha: `canvas.toBlob()` + IPC nativo (desktop) / download (navegador)**

- A exportação **sempre** parte do original + `EditState` em **resolução total** (`renderPhotoForExport`), nunca do preview.
- `canvas.toBlob(mime, quality)` gera JPEG/PNG/WEBP com a qualidade escolhida (40–100 no JPEG/WEBP).
- **Desktop**: `FileService` envia o `ArrayBuffer` por IPC para o processo principal, que abre `dialog.showSaveDialog` (com nome sugerido, filtros por formato e confirmação de sobrescrita) e grava com `fs.writeFile`.
- **Navegador**: `Blob` + `<a download>` (sem diálogo nativo, como esperado na web).
- O nome de arquivo é sempre **novo** (`nome-editada-AAAAMMDD-HHMM.jpg`), garantindo que o original nunca seja destruído por acidente.

---

## 9. Build e qualidade

- **Vite 7** com `base: './'` (o build precisa funcionar em `lumina://`) e *chunks* separados para TensorFlow/UpscalerJS (carregados só ao abrir o upscale).
- **esbuild** empacota `electron/main.ts` e `electron/preload.ts` em CJS (`electron-dist/`), mantendo `electron` como externo.
- **Vitest**: 67 testes cobrindo geometria, recorte, histórico, filtros, formatos, zoom, escalas de IA e a store (incluindo undo/redo e agrupamento de gestos).
- **TypeScript estrito** em todo o projeto (renderer + processos do Electron).

---

## 10. Resumo das dependências

| Dependência | Versão | Uso |
| --- | --- | --- |
| `electron` | 38 | Shell desktop Windows |
| `electron-builder` | 26 | Instalador NSIS + associação de arquivos |
| `react` / `react-dom` | 19 | Interface |
| `zustand` | 5 | Estado global |
| `lucide-react` | 0.544 | Ícones |
| `@tensorflow/tfjs` | 4.11 | Inferência neural no navegador/desktop |
| `upscaler` | 1.0 | Pipeline de patches da super-resolução |
| `@upscalerjs/esrgan-slim` | 1.0 | Pesos do modelo (2×, 3×, 4×) |
| `vite` / `@vitejs/plugin-react` | 7 | Dev server e build |
| `typescript` | 5.9 | Tipagem estrita |
| `vitest` | 3 | Testes unitários |
| `esbuild` | 0.25 | Bundle dos processos do Electron |
