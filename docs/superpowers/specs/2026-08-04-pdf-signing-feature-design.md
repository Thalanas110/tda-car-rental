# PDF Signing Feature Design

## Use
Test-driven development is required. Use codex's test driven development skill.

## Overview

Add a "Contracts" page to TDA Car Rental that lets users upload an existing PDF contract, place freeform text boxes and a signature image (`tda-signature.png`) anywhere on the PDF via an interactive preview, then export the modified PDF as a file download.

## User Flow

1. User navigates to `/contracts` (new sidebar nav item: "Contracts")
2. Upload area accepts a PDF file (drag-and-drop or file picker)
3. First page renders as a canvas preview; toolbar offers "Add Text" and "Add Signature" modes
4. User clicks on the preview to place items:
   - **Text boxes:** click to place → immediately focused for typing → drag to reposition → resize via corner handles
   - **Signature:** click toolbar → click on page → signature image appears → drag to reposition → resize via corner handles
5. Page navigation (prev/next) for multi-page PDFs; overlays are per-page
6. "Download" button exports the modified PDF with all overlays baked in

## Architecture

### Libraries

| Library | Purpose | Size |
|---------|---------|------|
| `pdfjs-dist` (pdf.js) | Render PDF pages as `<canvas>` for preview | ~200KB |
| `pdf-lib` | Modify PDF (stamp text/images), export | ~100KB |

### New Files

| File | Purpose |
|------|---------|
| `src/routes/contracts.tsx` | Route definition + meta tags |
| `src/components/ContractEditor.tsx` | Main orchestrator: upload, toolbar, page nav, export |
| `src/components/pdf/PdfPreview.tsx` | Renders PDF pages as canvas via pdf.js, handles click/drag events |
| `src/components/pdf/OverlayCanvas.tsx` | Manages placed items (text boxes, signature) as draggable/resizable overlays |
| `src/lib/contract-pdf.ts` | pdf-lib logic: loads original PDF, stamps text/images, exports |

### Modified Files

| File | Change |
|------|--------|
| `src/components/AppLayout.tsx` | Add "Contracts" nav item with `FileSignature` icon |
| `package.json` | Add `pdfjs-dist` and `pdf-lib` dependencies |

## Data Model

```ts
type OverlayItem = {
  id: string;
  type: "text" | "signature";
  pageNumber: number;
  x: number;       // PDF points (1/72 inch)
  y: number;
  width: number;   // PDF points
  height: number;
  content?: string; // text content for text boxes
  fontSize?: number; // default 12
};
```

All coordinates stored in PDF points (not pixels) for resolution independence.

## Coordinate Mapping

Canvas renders PDF at scaled size (fit-to-container). Mapping between canvas pixels and PDF points:

```
pdfX = canvasX * (pageWidth_points / canvasWidth_pixels)
pdfY = canvasY * (pageHeight_points / canvasHeight_pixels)
```

Where `pageWidth_points` and `pageHeight_points` come from the pdf.js viewport (e.g., `viewport.width`, `viewport.height`). Each page stores its viewport dimensions at render time.

## Export Flow (`contract-pdf.ts`)

1. Load original PDF bytes via `PDFDocument.load()`
2. For each page with overlays:
   - Embed Helvetica font (for text items)
   - Text items: `page.drawText()` at stored coordinates with configured font size
   - Signature: embed `tda-signature.png` via `pdfDoc.embedPng()`, then `page.drawImage()` at stored coordinates
3. `pdfDoc.save()` → trigger browser download via `URL.createObjectURL()` + programmatic `<a>` click

## Signature Asset

`tda-signature.png` loaded at component mount via Vite's `import.meta.glob` (same pattern as `src/lib/pdf.ts`).

## Resizable Items

Both text and signature overlays use pointer events for manipulation:

- **Drag:** `pointerdown` on item body → `pointermove` updates (x, y) → `pointerup` commits
- **Resize:** 4 corner handles (small squares at corners). `pointerdown` on handle → `pointermove` updates width/height (and x/y for top/left handles) → `pointerup` commits
- Minimum size enforced: 40×20pt for text, 60×40pt for signature
- Text content editable via contenteditable div when selected
- Font size configurable via a number input in the toolbar (default 12pt, range 6–72)

## Error Handling

- Invalid PDF → toast notification with error message
- Empty PDF → disable export, show "No pages" message
- Export failure → toast notification

## Testing

- Unit tests for coordinate mapping functions
- Unit tests for `contract-pdf.ts` export logic (mock PDF input, verify output)
- Component tests for `ContractEditor` (upload flow, toolbar state, overlay placement)
