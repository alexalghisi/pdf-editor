**Author:** Alghisi Alessandro Paolo  
**Contact:** alexalghisi@gmail.com

# PDF Editor

[![CI](https://github.com/alexalghisi/pdf-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/alexalghisi/pdf-editor/actions/workflows/ci.yml)
[![Deploy](https://github.com/alexalghisi/pdf-editor/actions/workflows/pages.yml/badge.svg)](https://github.com/alexalghisi/pdf-editor/actions/workflows/pages.yml)

**▶ Open the app: https://alexalghisi.github.io/pdf-editor/** — runs in any modern browser on desktop, Android and iPhone. No install needed.

A professional React Native PDF editor that loads, parses, and **rewrites the PDF content stream**. Text and images are first-class nodes in the document AST. Mutations are not flattened annotations.

| Desktop browser                           | Phone browser                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| ![Editor on desktop](docs/editor-web.jpg) | <img src="docs/editor-mobile.jpg" alt="Editor on a phone" width="260"> |

![Moving a heading and typing a new line on a page printed from Chrome](docs/editor-demo.gif)

The page preview is the real PDF, re-rendered after each edit. Here a blank letter page has two text blocks and an image. They were inserted, typed and dragged in place, and the result exports as a regular PDF.

The project is built with TDD, Clean Architecture, and strict TypeScript. Page rasterization runs in a JSI/Expo native module (PDFKit on iOS, `PdfRenderer` on Android) so large documents never block the JS thread.

## Architecture

```
pdf-editor/
├── App.tsx
├── index.ts
├── modules/pdf-native-engine/          # JSI native rasterizer
│   ├── ios/PdfNativeEngineModule.swift # PDFKit
│   └── android/.../PdfNativeEngineModule.kt
└── src/
    ├── domain/                         # Enterprise rules — no I/O
    │   ├── entities/                   # PdfDocument, PdfPage, nodes
    │   ├── valueObjects/               # Rect, RgbColor, PdfObjectId, Matrix
    │   ├── services/PdfAstEngine.ts    # Port (hexagonal)
    │   └── errors/
    ├── application/                    # Use cases
    │   ├── ports/                      # FileSystem, PageRenderer
    │   └── useCases/                   # Load, Save, Mutate
    ├── infrastructure/                 # Adapters
    │   ├── pdf/                        # Content-stream parser + rewriter
    │   ├── native/                     # TurboModule spec + fallback
    │   ├── fs/                         # Expo file system
    │   └── di/container.ts
    └── presentation/                   # UI — no PDF object-graph knowledge
        ├── store/editorStore.ts        # Zustand
        ├── canvas/                     # Pinch-zoom, drag, inline edit
        ├── screens/
        └── theme/
```

```mermaid
flowchart LR
  UI[Presentation / Zustand] --> UC[Application use cases]
  UC --> Port[PdfAstEngine port]
  Port --> Engine[PdfLibAstEngine]
  Engine --> Parser[Content-stream parser]
  Engine --> Lib[pdf-lib object graph]
  UI --> Render[PageRendererPort]
  Render --> Native[PdfNativeEngine JSI]
  Native --> PDFKit[iOS PDFKit]
  Native --> AndroidPdf[Android PdfRenderer]
```

```mermaid
flowchart TB
  Bytes[PDF bytes] --> Load[PDFDocument.load]
  Load --> Streams[Decode page Contents]
  Streams --> Tokens[Tokenizer]
  Tokens --> AST[Text / Image / Passthrough fragments]
  AST --> UINodes[Canvas nodes]
  UINodes -->|add / update / move / delete| Rewrite[Content-stream rewriter]
  Rewrite --> Streams
  Rewrite --> Save[serialize + original Info dict]
```

### Why this split

| Layer          | Responsibility                                                                         |
| -------------- | -------------------------------------------------------------------------------------- |
| Domain         | Immutable document model in ISO 32000 user space. No React, no pdf-lib.                |
| Application    | Orchestrates ports. Returns `Result<T, PdfDomainError>`.                               |
| Infrastructure | Parses operators (`Tj`, `TJ`, `Do`, `cm`, …), rewrites streams, embeds fonts/XObjects. |
| Native         | Rasterizes a page off-thread. Never owns the AST.                                      |
| Presentation   | Converts PDF space ↔ screen space. Drag, pinch, inline text.                           |

UI components never import `pdf-lib`. The store talks only to use cases.

## Capabilities

- Load and parse existing PDFs (catalog, pages, Info dictionary).
- Extract **text** (`BT`/`Tj`/`TJ`) and **images** (`Do` XObjects) with page-space bounds.
- Add, update, delete, and move text and images by rewriting the page content stream.
- Preserve vector art as passthrough operator groups.
- Untouched operators are written back as they were, so a page that is only partly edited keeps the rest of its content operator for operator — including pages drawn under a flipped or scaled CTM, as browsers and office suites produce them.
- Lossless save that restores title, author, creator, and producer.
- Interactive canvas: tap to select, drag to move, tap a selected text again to edit it, pinch or `−`/`+` to zoom.
- Live page preview of the edited document: pdf.js on web, `PdfNativeEngine` in a dev client / release build.

### Known limitations

- Existing text in fonts with a two-byte encoding (`Identity-H`, the usual output of browsers and office suites) is extracted as glyph ids. You can move or delete it, but in-place text edits are only reliable for simple-encoded and newly added text.
- Text drawn inside form XObjects is rendered but not yet exposed as editable nodes.

## Setup

```bash
cd pdf-editor
npm install
npm test
npm run typecheck
npx expo start
```

A development build is required for the native rasterizer:

```bash
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

Expo Go still edits the AST. The canvas draws a paper surface and node overlays when the JSI module is absent.

### Run in the browser (no Xcode required)

The engine is `pdf-lib`, so the whole editor runs unchanged on the web. A build is
published to GitHub Pages and works on any device — including an iPhone — straight
from the browser:

**Live app:** https://alexalghisi.github.io/pdf-editor/

```bash
npm run build:web   # exports a static bundle to ./dist
npx expo start --web
```

On web, document/image pickers hand back `blob:`/`data:` URIs, and a save is
delivered as a browser download of the edited PDF. Pages are rasterized by
pdf.js in a module worker (`public/pdf.worker.min.mjs`, copied from
`node_modules` on `npm install`). Every push to `main` rebuilds and redeploys the
site through the `Deploy web app` workflow.

### Scripts

| Command                 | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `npm test`              | Jest + Testing Library (TDD suite)                  |
| `npm run test:coverage` | Coverage with thresholds                            |
| `npm run typecheck`     | `tsc --noEmit`, strict + `noUncheckedIndexedAccess` |
| `npx expo start`        | Metro bundler                                       |
| `npm run build:web`     | Static web export to `./dist`                       |

## TDD map

Tests were written before the engine implementation:

1. `src/infrastructure/pdf/contentStream/__tests__/tokenizer.test.ts`
2. `src/infrastructure/pdf/contentStream/__tests__/parser.test.ts`
3. `src/infrastructure/pdf/__tests__/PdfAstEngine.parse.test.ts`
4. `src/infrastructure/pdf/__tests__/PdfAstEngine.mutate.test.ts`

Fixtures are hand-rolled ISO 32000 files (`buildFixturePdf`), not objects that pdf-lib already understands.

## Native contract (JSI / TurboModule)

```ts
type NativePdfEngineSpec = {
  getPageCount(path: string): Promise<number>;
  getPageSize(
    path: string,
    pageIndex: number,
  ): Promise<{ width: number; height: number }>;
  renderPage(
    path: string,
    pageIndex: number,
    scale: number,
  ): Promise<{
    uri: string;
    width: number;
    height: number;
  }>;
};
```

Decoded bitmaps are written to a temp PNG and released. The JS thread only receives a URI.

## State

Zustand holds the open `PdfDocument`, selection, page index, and zoom. Mutations go through `MutateDocument`, which snapshots the engine session so the UI always reads a fresh immutable graph.

## License

Private. All rights reserved unless otherwise agreed with the author.
