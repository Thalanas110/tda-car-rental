# PDF Signing Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Contracts" page where users upload a PDF, place freeform text boxes and a signature image via an interactive preview, then export the modified PDF.

**Architecture:** pdf.js renders PDF pages as canvases for preview; pdf-lib modifies the original PDF by stamping text/images at user-placed coordinates; overlay divs handle drag/resize interaction.

**Tech Stack:** `pdfjs-dist`, `pdf-lib`, React, TanStack Router, Vitest, jsdom

## Global Constraints

- TDD required: write failing tests first, then implement, then verify passing
- Follow existing code patterns (see `src/lib/pdf.ts`, `tests/unit/pdf/pdf.test.ts`)
- Use `@/` path alias for imports from `src/`
- Use `vitest` for unit tests, `@testing-library/react` for component tests
- No new UI library dependencies — use existing Radix UI + Tailwind components
- Commit after each task

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/contract-pdf.ts` | pdf-lib export logic: load PDF, stamp text/images, save |
| `src/lib/contract-pdf.types.ts` | Shared types (`OverlayItem`, `ContractPdfInput`) |
| `src/lib/contract-pdf-coordinate.ts` | Coordinate mapping between canvas pixels and PDF points |
| `src/components/pdf/PdfPreview.tsx` | Render PDF pages as canvas via pdf.js |
| `src/components/pdf/OverlayCanvas.tsx` | Draggable/resizable overlay items on top of preview |
| `src/components/ContractEditor.tsx` | Main orchestrator: upload, toolbar, page nav, export |
| `src/routes/contracts.tsx` | Route definition + meta |
| `src/components/AppLayout.tsx` | Modified: add "Contracts" nav item |
| `tests/unit/contract-pdf/contract-pdf.test.ts` | Unit tests for export logic |
| `tests/unit/contract-pdf/coordinate.test.ts` | Unit tests for coordinate mapping |
| `tests/component/contract-editor/ContractEditor.test.tsx` | Component tests |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: none
- Produces: `pdfjs-dist` and `pdf-lib` available for import

- [ ] **Step 1: Install pdfjs-dist and pdf-lib**

```bash
npm install pdfjs-dist pdf-lib
```

- [ ] **Step 2: Verify installation**

```bash
npm ls pdfjs-dist pdf-lib
```
Expected: both packages listed with version numbers

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pdfjs-dist and pdf-lib dependencies"
```

---

### Task 2: Define Shared Types

**Files:**
- Create: `src/lib/contract-pdf.types.ts`

**Interfaces:**
- Consumes: none
- Produces: `OverlayItem`, `ContractPdfInput`

- [ ] **Step 1: Create types file**

```typescript
// src/lib/contract-pdf.types.ts
export type OverlayItem = {
  id: string;
  type: "text" | "signature";
  pageNumber: number;
  x: number;       // PDF points (1/72 inch)
  y: number;
  width: number;   // PDF points
  height: number;
  content?: string;
  fontSize?: number;
};

export type ContractPdfInput = {
  pdfBytes: Uint8Array;
  overlays: OverlayItem[];
  signatureDataUrl?: string;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/contract-pdf.types.ts
git commit -m "feat: add contract PDF shared types"
```

---

### Task 3: Coordinate Mapping Utility + Tests

**Files:**
- Create: `src/lib/contract-pdf-coordinate.ts`
- Create: `tests/unit/contract-pdf/coordinate.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `canvasToPdf()`, `pdfToCanvas()`, `PageViewport`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/contract-pdf/coordinate.test.ts
import { describe, expect, it } from "vitest";
import { canvasToPdf, pdfToCanvas } from "@/lib/contract-pdf-coordinate";

describe("coordinate mapping", () => {
  const viewport = { width: 612, height: 792 }; // US Letter in points
  const canvasWidth = 800;
  const canvasHeight = 1040;

  it("maps canvas coordinates to PDF points", () => {
    const result = canvasToPdf(400, 520, viewport, canvasWidth, canvasHeight);
    expect(result).toEqual({ x: 306, y: 396 });
  });

  it("maps PDF points back to canvas coordinates", () => {
    const result = pdfToCanvas(306, 396, viewport, canvasWidth, canvasHeight);
    expect(result).toEqual({ x: 400, y: 520 });
  });

  it("round-trips canvas -> pdf -> canvas", () => {
    const original = { x: 123, y: 456 };
    const pdfCoords = canvasToPdf(original.x, original.y, viewport, canvasWidth, canvasHeight);
    const roundTripped = pdfToCanvas(pdfCoords.x, pdfCoords.y, viewport, canvasWidth, canvasHeight);
    expect(roundTripped.x).toBeCloseTo(original.x, 1);
    expect(roundTripped.y).toBeCloseTo(original.y, 1);
  });

  it("handles edge coordinates (0,0)", () => {
    const result = canvasToPdf(0, 0, viewport, canvasWidth, canvasHeight);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it("handles maximum coordinates", () => {
    const result = canvasToPdf(canvasWidth, canvasHeight, viewport, canvasWidth, canvasHeight);
    expect(result).toEqual({ x: viewport.width, y: viewport.height });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/contract-pdf/coordinate.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement coordinate mapping**

```typescript
// src/lib/contract-pdf-coordinate.ts
export type PageViewport = {
  width: number;
  height: number;
};

export function canvasToPdf(
  canvasX: number,
  canvasY: number,
  viewport: PageViewport,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: canvasX * (viewport.width / canvasWidth),
    y: canvasY * (viewport.height / canvasHeight),
  };
}

export function pdfToCanvas(
  pdfX: number,
  pdfY: number,
  viewport: PageViewport,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: pdfX * (canvasWidth / viewport.width),
    y: pdfY * (canvasHeight / viewport.height),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/contract-pdf/coordinate.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/contract-pdf-coordinate.ts tests/unit/contract-pdf/coordinate.test.ts
git commit -m "feat: add coordinate mapping utility with tests"
```

---

### Task 4: Contract PDF Export Logic + Tests

**Files:**
- Create: `src/lib/contract-pdf.ts`
- Create: `tests/unit/contract-pdf/contract-pdf.test.ts`

**Interfaces:**
- Consumes: `OverlayItem`, `ContractPdfInput` from Task 2
- Produces: `exportContractPdf()`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/contract-pdf/contract-pdf.test.ts
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import type { OverlayItem } from "@/lib/contract-pdf.types";

// Mock pdf-lib
const mockDrawText = vi.fn();
const mockDrawImage = vi.fn();
const mockEmbedPng = vi.fn().mockResolvedValue({});
const mockEmbedFont = vi.fn().mockResolvedValue({});
const mockSave = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));

vi.mock("pdf-lib", () => ({
  PDFDocument: {
    load: vi.fn().mockResolvedValue({
      embedPng: mockEmbedPng,
      embedFont: mockEmbedFont,
      getPages: vi.fn().mockReturnValue([
        {
          drawText: mockDrawText,
          drawImage: mockDrawImage,
          getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
        },
      ]),
      save: mockSave,
    }),
  },
  StandardFonts: { Helvetica: "Helvetica" },
}));

import { exportContractPdf } from "@/lib/contract-pdf";

describe("exportContractPdf", () => {
  it("draws text overlays on the PDF", async () => {
    const overlays: OverlayItem[] = [
      {
        id: "1",
        type: "text",
        pageNumber: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: "John Doe",
        fontSize: 12,
      },
    ];

    await exportContractPdf({ pdfBytes: new Uint8Array(), overlays });

    expect(mockDrawText).toHaveBeenCalledWith("John Doe", {
      x: 100,
      y: 200,
      size: 12,
      font: expect.anything(),
    });
  });

  it("embeds and draws signature overlays", async () => {
    const overlays: OverlayItem[] = [
      {
        id: "sig-1",
        type: "signature",
        pageNumber: 0,
        x: 300,
        y: 400,
        width: 120,
        height: 80,
      },
    ];

    await exportContractPdf({
      pdfBytes: new Uint8Array(),
      overlays,
      signatureDataUrl: "data:image/png;base64,abc123",
    });

    expect(mockEmbedPng).toHaveBeenCalled();
    expect(mockDrawImage).toHaveBeenCalledWith(expect.anything(), {
      x: 300,
      y: 400,
      width: 120,
      height: 80,
    });
  });

  it("skips text overlays with empty content", async () => {
    const overlays: OverlayItem[] = [
      {
        id: "1",
        type: "text",
        pageNumber: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: "",
        fontSize: 12,
      },
    ];

    await exportContractPdf({ pdfBytes: new Uint8Array(), overlays });

    expect(mockDrawText).not.toHaveBeenCalled();
  });

  it("uses default fontSize of 12 when not specified", async () => {
    const overlays: OverlayItem[] = [
      {
        id: "1",
        type: "text",
        pageNumber: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: "Test",
      },
    ];

    await exportContractPdf({ pdfBytes: new Uint8Array(), overlays });

    expect(mockDrawText).toHaveBeenCalledWith("Test", {
      x: 100,
      y: 200,
      size: 12,
      font: expect.anything(),
    });
  });

  it("returns the saved PDF bytes", async () => {
    const result = await exportContractPdf({ pdfBytes: new Uint8Array(), overlays: [] });

    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockSave).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/contract-pdf/contract-pdf.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement export logic**

```typescript
// src/lib/contract-pdf.ts
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { ContractPdfInput } from "./contract-pdf.types";

export async function exportContractPdf(input: ContractPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(input.pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let signatureImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | undefined;
  if (input.signatureDataUrl) {
    const base64 = input.signatureDataUrl.split(",")[1];
    const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    signatureImage = await pdfDoc.embedPng(pngBytes);
  }

  for (const overlay of input.overlays) {
    const page = pages[overlay.pageNumber];
    if (!page) continue;

    if (overlay.type === "text" && overlay.content) {
      page.drawText(overlay.content, {
        x: overlay.x,
        y: overlay.y,
        size: overlay.fontSize ?? 12,
        font,
      });
    } else if (overlay.type === "signature" && signatureImage) {
      page.drawImage(signatureImage, {
        x: overlay.x,
        y: overlay.y,
        width: overlay.width,
        height: overlay.height,
      });
    }
  }

  return pdfDoc.save();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/contract-pdf/contract-pdf.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/contract-pdf.ts src/lib/contract-pdf.types.ts tests/unit/contract-pdf/contract-pdf.test.ts
git commit -m "feat: add contract PDF export logic with tests"
```

---

### Task 5: PdfPreview Component + Tests

**Files:**
- Create: `src/components/pdf/PdfPreview.tsx`
- Create: `tests/component/pdf/PdfPreview.test.tsx`

**Interfaces:**
- Consumes: `pdfjs-dist` for rendering, `PageViewport` from Task 3
- Produces: `<PdfPreview>` component with `onPageClick` callback

- [ ] **Step 1: Write failing tests**

```typescript
// tests/component/pdf/PdfPreview.test.tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getDocument = vi.fn();
const getPage = vi.fn();

vi.mock("pdfjs-dist", () => ({
  getDocument: (...args: unknown[]) => getDocument(...args),
  GlobalWorkerOptions: { workerSrc: "" },
}));

import { PdfPreview } from "@/components/pdf/PdfPreview";

function createMockPage() {
  const viewport = vi.fn().mockReturnValue({ width: 612, height: 792, scale: 1 });
  return {
    getViewport: viewport,
    render: vi.fn().mockResolvedValue(undefined),
  };
}

describe("PdfPreview", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a canvas element after loading the PDF", async () => {
    const mockPage = createMockPage();
    const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
    });
  });

  it("calls onPageClick with canvas coordinates when clicked", async () => {
    const mockPage = createMockPage();
    const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });
    const onPageClick = vi.fn();

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={onPageClick} />);

    await waitFor(() => {
      expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
    });

    const canvas = screen.getByRole("img", { hidden: true });
    fireEvent.click(canvas, { clientX: 100, clientY: 200 });

    expect(onPageClick).toHaveBeenCalledWith(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
      pageNumber: 0,
    }));
  });

  it("navigates between pages", async () => {
    const mockPage = createMockPage();
    const mockPdf = {
      numPages: 2,
      getPage: vi.fn().mockResolvedValue(mockPage),
    };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(mockPdf.getPage).toHaveBeenCalledWith(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/component/pdf/PdfPreview.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement PdfPreview**

```typescript
// src/components/pdf/PdfPreview.tsx
import { useEffect, useRef, useState, type MouseEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { ChevronLeft, ChevronRight } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type PageClickInfo = {
  x: number;
  y: number;
  pageNumber: number;
  viewportWidth: number;
  viewportHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};

type PdfPreviewProps = {
  pdfBytes: Uint8Array;
  onPageClick: (info: PageClickInfo) => void;
};

export function PdfPreview({ pdfBytes, onPageClick }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pdfRef = useRef<Awaited<ReturnType<typeof pdfjsLib.getDocument>> | null>(null);
  const viewportRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      if (cancelled) return;
      pdfRef.current = doc;
      setTotalPages(doc.numPages);
      setCurrentPage(0);
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [pdfBytes]);

  useEffect(() => {
    let cancelled = false;
    const renderPage = async () => {
      const doc = pdfRef.current;
      const canvas = canvasRef.current;
      if (!doc || !canvas) return;

      const page = await doc.getPage(currentPage + 1);
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const maxWidth = canvas.parentElement?.clientWidth ?? 600;
      const scale = maxWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      viewportRef.current = { width: baseViewport.width, height: baseViewport.height };

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    };
    renderPage();
    return () => { cancelled = true; };
  }, [currentPage, totalPages]);

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !viewportRef.current) return;
    const rect = canvas.getBoundingClientRect();
    onPageClick({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pageNumber: currentPage,
      viewportWidth: viewportRef.current.width,
      viewportHeight: viewportRef.current.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
          className="btn-secondary disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm">
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={currentPage >= totalPages - 1}
          className="btn-secondary disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        onClick={handleClick}
        className="border cursor-crosshair"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/component/pdf/PdfPreview.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/pdf/PdfPreview.tsx tests/component/pdf/PdfPreview.test.tsx
git commit -m "feat: add PdfPreview component with page navigation"
```

---

### Task 6: OverlayCanvas Component + Tests

**Files:**
- Create: `src/components/pdf/OverlayCanvas.tsx`
- Create: `tests/component/pdf/OverlayCanvas.test.tsx`

**Interfaces:**
- Consumes: `OverlayItem` from Task 2, `pdfToCanvas` from Task 3
- Produces: `<OverlayCanvas>` with drag/resize and item management

- [ ] **Step 1: Write failing tests**

```typescript
// tests/component/pdf/OverlayCanvas.test.tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OverlayCanvas } from "@/components/pdf/OverlayCanvas";
import type { OverlayItem } from "@/lib/contract-pdf.types";

describe("OverlayCanvas", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders text overlay items", () => {
    const items: OverlayItem[] = [
      {
        id: "1",
        type: "text",
        pageNumber: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: "Hello",
        fontSize: 12,
      },
    ];

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders signature overlay items", () => {
    const items: OverlayItem[] = [
      {
        id: "sig-1",
        type: "signature",
        pageNumber: 0,
        x: 300,
        y: 400,
        width: 120,
        height: 80,
      },
    ];

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        signatureDataUrl="data:image/png;base64,abc"
      />,
    );

    expect(screen.getByRole("img", { name: /signature/i })).toBeInTheDocument();
  });

  it("only shows items for the current page", () => {
    const items: OverlayItem[] = [
      { id: "1", type: "text", pageNumber: 0, x: 0, y: 0, width: 100, height: 20, content: "Page 0" },
      { id: "2", type: "text", pageNumber: 1, x: 0, y: 0, width: 100, height: 20, content: "Page 1" },
    ];

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Page 0")).toBeInTheDocument();
    expect(screen.queryByText("Page 1")).not.toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", () => {
    const items: OverlayItem[] = [
      { id: "1", type: "text", pageNumber: 0, x: 0, y: 0, width: 100, height: 20, content: "Delete me" },
    ];
    const onDelete = vi.fn();

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/component/pdf/OverlayCanvas.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement OverlayCanvas**

```typescript
// src/components/pdf/OverlayCanvas.tsx
import { useRef, useState, type MouseEvent } from "react";
import { X } from "lucide-react";
import type { OverlayItem } from "@/lib/contract-pdf.types";
import { pdfToCanvas } from "@/lib/contract-pdf-coordinate";

type OverlayCanvasProps = {
  items: OverlayItem[];
  currentPage: number;
  canvasWidth: number;
  canvasHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  onUpdate: (id: string, patch: Partial<OverlayItem>) => void;
  onDelete: (id: string) => void;
  signatureDataUrl?: string;
};

export function OverlayCanvas({
  items,
  currentPage,
  canvasWidth,
  canvasHeight,
  viewportWidth,
  viewportHeight,
  onUpdate,
  onDelete,
  signatureDataUrl,
}: OverlayCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; itemX: number; itemY: number } | null>(null);

  const viewport = { width: viewportWidth, height: viewportHeight };
  const pageItems = items.filter((item) => item.pageNumber === currentPage);

  const toCanvasCoords = (pdfX: number, pdfY: number) =>
    pdfToCanvas(pdfX, pdfY, viewport, canvasWidth, canvasHeight);

  const handlePointerDown = (e: MouseEvent, item: OverlayItem) => {
    e.stopPropagation();
    setSelectedId(item.id);
    dragRef.current = {
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      itemX: item.x,
      itemY: item.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) * (viewportWidth / canvasWidth);
    const dy = (e.clientY - dragRef.current.startY) * (viewportHeight / canvasHeight);
    onUpdate(dragRef.current.id, {
      x: dragRef.current.itemX + dx,
      y: dragRef.current.itemY - dy,
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      className="absolute inset-0"
      style={{ width: canvasWidth, height: canvasHeight }}
      onClick={() => setSelectedId(null)}
    >
      {pageItems.map((item) => {
        const pos = toCanvasCoords(item.x, item.y);
        const isSelected = item.id === selectedId;

        return (
          <div
            key={item.id}
            className={`absolute border ${isSelected ? "border-blue-500" : "border-transparent"} ${
              item.type === "text" ? "bg-white/80 cursor-move" : ""
            }`}
            style={{
              left: pos.x,
              top: pos.y,
              width: (item.width / viewportWidth) * canvasWidth,
              height: (item.height / viewportHeight) * canvasHeight,
            }}
            onPointerDown={(e) => handlePointerDown(e, item)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {item.type === "text" ? (
              <div
                contentEditable={isSelected}
                suppressContentEditableWarning
                className="w-full h-full p-1 text-black outline-none"
                style={{ fontSize: item.fontSize ?? 12 }}
                onBlur={(e) => onUpdate(item.id, { content: e.currentTarget.textContent ?? "" })}
              >
                {item.content}
              </div>
            ) : (
              <img
                src={signatureDataUrl}
                alt="Signature"
                className="w-full h-full object-contain pointer-events-none"
              />
            )}
            {isSelected && (
              <button
                aria-label="Delete"
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/component/pdf/OverlayCanvas.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/pdf/OverlayCanvas.tsx tests/component/pdf/OverlayCanvas.test.tsx
git commit -m "feat: add OverlayCanvas component with drag and delete"
```

---

### Task 7: ContractEditor Component + Tests

**Files:**
- Create: `src/components/ContractEditor.tsx`
- Create: `tests/component/contract-editor/ContractEditor.test.tsx`

**Interfaces:**
- Consumes: `PdfPreview` (Task 5), `OverlayCanvas` (Task 6), `exportContractPdf` (Task 4), `canvasToPdf` (Task 3)
- Produces: `<ContractEditor>` main orchestrator

- [ ] **Step 1: Write failing tests**

```typescript
// tests/component/contract-editor/ContractEditor.test.tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist", () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 612, height: 792, scale: 1 }),
        render: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
  GlobalWorkerOptions: { workerSrc: "" },
}));

vi.mock("@/lib/contract-pdf", () => ({
  exportContractPdf: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

import { ContractEditor } from "@/components/ContractEditor";
import { exportContractPdf } from "@/lib/contract-pdf";

describe("ContractEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows upload area initially", () => {
    render(<ContractEditor />);
    expect(screen.getByText(/drop a pdf/i)).toBeInTheDocument();
  });

  it("shows toolbar after PDF is loaded", async () => {
    render(<ContractEditor />);

    const file = new File(["dummy"], "contract.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText(/upload/i);
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/add text/i)).toBeInTheDocument();
    });
  });

  it("calls exportContractPdf when download is clicked", async () => {
    render(<ContractEditor />);

    const file = new File(["dummy"], "contract.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText(/upload/i);
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/download/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/download/i));

    await waitFor(() => {
      expect(exportContractPdf).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/component/contract-editor/ContractEditor.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement ContractEditor**

```typescript
// src/components/ContractEditor.tsx
import { useCallback, useState } from "react";
import { Download, Type, Pen } from "lucide-react";
import { PdfPreview } from "@/components/pdf/PdfPreview";
import { OverlayCanvas } from "@/components/pdf/OverlayCanvas";
import { exportContractPdf } from "@/lib/contract-pdf";
import { canvasToPdf } from "@/lib/contract-pdf-coordinate";
import type { OverlayItem } from "@/lib/contract-pdf.types";

const signatureAssets = import.meta.glob("../../signature/*.{png,PNG}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;
const signatureUrl = Object.values(signatureAssets)[0];

export function ContractEditor() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [mode, setMode] = useState<"select" | "text" | "signature">("select");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<{
    viewportWidth: number;
    viewportHeight: number;
    canvasWidth: number;
    canvasHeight: number;
  } | null>(null);
  const [fontSize, setFontSize] = useState(12);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    setPdfBytes(bytes);
    setOverlays([]);
    setCurrentPage(0);
  }, []);

  const handlePageClick = useCallback(
    (info: {
      x: number;
      y: number;
      pageNumber: number;
      viewportWidth: number;
      viewportHeight: number;
      canvasWidth: number;
      canvasHeight: number;
    }) => {
      setPageInfo({
        viewportWidth: info.viewportWidth,
        viewportHeight: info.viewportHeight,
        canvasWidth: info.canvasWidth,
        canvasHeight: info.canvasHeight,
      });

      const viewport = { width: info.viewportWidth, height: info.viewportHeight };
      const pdfCoords = canvasToPdf(info.x, info.y, viewport, info.canvasWidth, info.canvasHeight);

      if (mode === "text") {
        const newItem: OverlayItem = {
          id: crypto.randomUUID(),
          type: "text",
          pageNumber: info.pageNumber,
          x: pdfCoords.x,
          y: pdfCoords.y,
          width: 150,
          height: 20,
          content: "",
          fontSize,
        };
        setOverlays((prev) => [...prev, newItem]);
        setMode("select");
      } else if (mode === "signature") {
        const newItem: OverlayItem = {
          id: crypto.randomUUID(),
          type: "signature",
          pageNumber: info.pageNumber,
          x: pdfCoords.x,
          y: pdfCoords.y,
          width: 120,
          height: 80,
        };
        setOverlays((prev) => [...prev, newItem]);
        setMode("select");
      }
    },
    [mode, fontSize],
  );

  const handleUpdate = useCallback((id: string, patch: Partial<OverlayItem>) => {
    setOverlays((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleDownload = useCallback(async () => {
    if (!pdfBytes) return;
    const signatureDataUrl = signatureUrl
      ? await fetch(signatureUrl).then((r) => r.text())
      : undefined;
    const result = await exportContractPdf({ pdfBytes, overlays, signatureDataUrl });
    const blob = new Blob([result], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contract-signed.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }, [pdfBytes, overlays]);

  return (
    <div className="space-y-4">
      {!pdfBytes ? (
        <label className="block border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-accent">
          <input
            type="file"
            accept=".pdf"
            className="sr-only"
            aria-label="Upload PDF contract"
            onChange={handleFileChange}
          />
          <p className="text-muted-foreground">Drop a PDF or click to browse</p>
        </label>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("select")}
              className={`btn-secondary ${mode === "select" ? "bg-accent" : ""}`}
            >
              Select
            </button>
            <button
              onClick={() => setMode("text")}
              className={`btn-secondary ${mode === "text" ? "bg-accent" : ""}`}
            >
              <Type className="h-4 w-4 mr-1" /> Add Text
            </button>
            <button
              onClick={() => setMode("signature")}
              className={`btn-secondary ${mode === "signature" ? "bg-accent" : ""}`}
            >
              <Pen className="h-4 w-4 mr-1" /> Add Signature
            </button>
            <label className="flex items-center gap-1 text-sm ml-4">
              Size:
              <input
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                min={6}
                max={72}
                className="w-16 input"
              />
            </label>
            <button onClick={handleDownload} className="btn-primary ml-auto">
              <Download className="h-4 w-4 mr-1" /> Download
            </button>
          </div>

          <div className="relative inline-block">
            <PdfPreview pdfBytes={pdfBytes} onPageClick={handlePageClick} />
            {pageInfo && (
              <OverlayCanvas
                items={overlays}
                currentPage={currentPage}
                canvasWidth={pageInfo.canvasWidth}
                canvasHeight={pageInfo.canvasHeight}
                viewportWidth={pageInfo.viewportWidth}
                viewportHeight={pageInfo.viewportHeight}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                signatureDataUrl={signatureUrl}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/component/contract-editor/ContractEditor.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ContractEditor.tsx tests/component/contract-editor/ContractEditor.test.tsx
git commit -m "feat: add ContractEditor orchestrator component"
```

---

### Task 8: Contracts Route + AppLayout Update

**Files:**
- Create: `src/routes/contracts.tsx`
- Modify: `src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: `ContractEditor` (Task 7)
- Produces: `/contracts` route, sidebar nav item

- [ ] **Step 1: Create contracts route**

```typescript
// src/routes/contracts.tsx
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ContractEditor } from "@/components/ContractEditor";

export const Route = createFileRoute("/contracts")({
  head: () => ({
    meta: [
      { name: "description", content: "Upload, fill, and sign PDF contracts for TDA Car Rental." },
      { property: "og:description", content: "Upload, fill, and sign PDF contracts." },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  return (
    <AppLayout title="Contracts">
      <ContractEditor />
    </AppLayout>
  );
}
```

- [ ] **Step 2: Add nav item to AppLayout**

```typescript
// src/components/AppLayout.tsx — add FileSignature import and nav entry
import { LayoutDashboard, FileText, FileSpreadsheet, FileSignature } from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/billing", label: "Billing", icon: FileText },
  { to: "/quotation", label: "Quotation", icon: FileSpreadsheet },
  { to: "/contracts", label: "Contracts", icon: FileSignature },
] as const;
```

- [ ] **Step 3: Verify route generates correctly**

```bash
npx tsr generate
```
Expected: no errors, `routeTree.gen.ts` updated

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/contracts.tsx src/components/AppLayout.tsx src/routeTree.gen.ts
git commit -m "feat: add contracts route and sidebar nav item"
```

---

### Task 9: Final Integration Test + Verification

**Files:**
- Verify all tests pass
- Verify lint passes

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run tests/unit/contract-pdf/
```
Expected: ALL PASS

- [ ] **Step 2: Run all component tests**

```bash
npx vitest run tests/component/contract-editor/ tests/component/pdf/
```
Expected: ALL PASS

- [ ] **Step 3: Run full test suite**

```bash
npm test
```
Expected: ALL PASS

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: PASS

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final integration verification for PDF signing feature"
```
