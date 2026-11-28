# Improvement log

The working list for this project. Every round of work starts here: pick the highest item under **Next**, write the failing test first, make it pass, then move the item to **Done** with the date. Anything noticed along the way goes under **Next** or **Ideas** so it is not lost.

## Working rules

1. Test first. A change starts with a failing unit, component or end-to-end test that describes the behaviour.
2. Three layers of tests, all required to pass before a merge:
   - `npm test` — unit and component tests (Jest, Testing Library), with coverage thresholds.
   - `npm run e2e` — the built web app in Chrome: text editing and export (`edit-text`), toolbar and file handling (`toolbar`), layout on six screen sizes (`responsive`).
   - `npm run typecheck` and `npm run format:check`.
3. Every control is at least 44×44 px, has an accessible name and stays inside the screen from 320 px wide up to 1920 px.
4. Architecture stays layered: domain → application → infrastructure → presentation. UI code never imports `pdf-lib`.
5. The README preview images are regenerated whenever the interface changes.

## Next

| #   | Area          | Item                                                                                               |
| --- | ------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Editing       | Undo and redo (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z) with a history stack in the store.                    |
| 2   | Editing       | Select newly added text or image automatically and open text straight into edit mode.              |
| 3   | Editing       | Text formatting for the selected line: font size, colour, bold.                                    |
| 4   | Navigation    | Page thumbnails sidebar on wide screens; swipe between pages on phones.                            |
| 5   | Pages         | Add, delete, rotate and reorder pages.                                                             |
| 6   | Keyboard      | Delete/Backspace removes the selection, arrow keys nudge it, Ctrl/Cmd+S opens Save as, +/− zoom.   |
| 7   | Safety        | Warn before closing a document with unsaved changes.                                               |
| 8   | Zoom          | Fit width / fit page presets; Ctrl+wheel zoom on desktop.                                          |
| 9   | Accessibility | Automated axe audit in the e2e run; visible focus rings; trap focus inside the Save as dialog.     |
| 10  | Performance   | Lazy-load pdf.js and the export code; measure bundle size in CI and fail on regressions.           |
| 11  | Web app       | Installable PWA with offline support and a proper manifest, theme colour and social preview image. |
| 12  | Quality       | ESLint with the React, hooks and TypeScript rule sets in CI.                                       |
| 13  | Quality       | Visual regression: compare the responsive screenshots with stored baselines.                       |
| 14  | Tests         | Cover `PdfJsPageRenderer`, `useFileDrop` and `PdfCanvas` with component tests.                     |
| 15  | Editing       | Expose text inside form XObjects as editable nodes.                                                |
| 16  | Images        | Resize handles for images and text boxes.                                                          |
| 17  | Files         | Remember recently opened documents (IndexedDB on web).                                             |
| 18  | Feedback      | Toast after a successful save; progress indicator for large files.                                 |
| 19  | iOS           | Port the content-stream rewriter to Swift so the native app replaces text instead of covering it.  |
| 20  | iOS           | Page thumbnails, pinch to resize images, match the page background colour behind edited lines.     |
| 21  | Releases      | Sign and notarise the macOS and Windows builds; TestFlight for iOS; Play Store bundle for Android. |
| 22  | Desktop       | Open a PDF passed on the command line or by double-click; native Save dialog.                      |

## Ideas

- Save every page as images in one ZIP.
- Search inside the document, with matches highlighted on the page.
- Annotations: highlight, underline, free-hand drawing.
- Fill in AcroForm fields.
- Merge and split PDFs.
- Light theme following the system setting.
- Romanian and Italian interface.

## Done

### 2026-11-28

- Native iPhone and iPad app in `ios-native/` (SwiftUI, PDFKit): tap a line to edit it, add text and images, change size, colour and weight, hold and drag to move, undo and redo, rotate and delete pages, Save as in seven formats. 40 XCTest unit tests run on the simulator in CI.
- Desktop app in `desktop/` (Electron) for Windows, macOS and Linux, with tests for the local file server.
- Release workflow: one tag builds Windows, macOS, Linux, Android, iOS and web downloads and attaches them to the GitHub release.

### 2026-11-27

- Save as PNG or JPEG: the current page is rendered at 3× and downloaded as an image (`report.png`, or `report-page-2.jpg` in a multi-page document).
- Tests: store, exporter and renderer unit tests for image export; the end-to-end run saves both image formats and checks the files.

### 2026-11-26

- New interface: start screen with a drop zone, icon toolbar grouped by purpose, floating page navigator, Save as sheet with a description for each format, refreshed colours and type scale.
- Drag and drop a PDF anywhere on the start screen (web).
- Zoom shows the current percentage, can be reset with one click and disables at its limits.
- The status line reads "Page 1 of 3" and only mentions activity while saving or loading.
- Fixed: a file that failed to load still opened an empty editor. The start screen now stays and shows the error.
- Fixed: the Save as menu was cut off on short screens (phone in landscape). It scrolls now.
- All controls are at least 44×44 px with accessible names.
- Tests: component tests for the start screen, editor, toolbar button and Save as sheet; new end-to-end suites for the toolbar, page navigation, drag and drop, broken files and layout on six screen sizes.
