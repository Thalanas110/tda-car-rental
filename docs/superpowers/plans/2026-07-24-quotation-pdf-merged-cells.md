# Excel-like Quotation PDF Merged Cells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render shared quotation Unit and Passenger values as vertically centered, Excel-like merged cells in the generated PDF.

**Architecture:** jsPDF AutoTable remains responsible for row sizing and pagination. Shared Unit and Passenger cell text is suppressed, their page-local geometry is recorded in didDrawCell, and one white-filled, black-outlined span with centered text is painted in didDrawPage for each physical page.

**Tech Stack:** TypeScript 5, jsPDF 4, jspdf-autotable 5, Vitest 4.

## Global Constraints

- Change quotation PDF rendering only; persisted quotation data and editor synchronization controls stay unchanged.
- Merge Unit only when every quotation row has the same non-empty Unit; merge Passenger only when every row has the same non-empty Passenger.
- A merged Unit/Passenger field has one black outer border, no internal horizontal lines, and text centered horizontally and vertically.
- Shared labels wrap to their normal inner cell width, and the source row reserves the wrapped label height before it is visually merged.
- If AutoTable breaks a shared field across pages, draw one independently centered merged segment on each physical page.
- Date, Destination, and Amount remain unmerged, row-level cells.
- Keep the quotation table geometry unchanged: 80pt left/right margins and Date 70, Unit 75, Destination 140, Passenger 85, Amount 82 widths.
- Use npm.cmd for project commands in this PowerShell workspace.

---

### Task 1: Render shared quotation fields as page-local merged spans

**Files:**
- Modify: src/lib/pdf.ts:67-195
- Test: src/lib/pdf.test.ts:27-207

**Interfaces:**
- Consumes: sharedQuoteUnit, sharedQuotePassenger, AutoTable CellHookData page/cell geometry, and quote line-item data.
- Produces: visually merged page-local Unit and Passenger cells whose labels are positioned at each span's geometric center.

- [ ] **Step 1: Write the failing centered-span test**

Extend the test table cell type and add a PDF-text position helper:

    type TableCell = {
      text: string[];
      x: number;
      y: number;
      width: number;
      height: number;
    };

    function textPositions(output: string, value: string) {
      const pattern = new RegExp("([0-9.]+) ([0-9.]+) Td\\n\\(" + value + "\\) Tj", "g");
      return Array.from(output.matchAll(pattern), (match) => ({
        x: Number(match[1]),
        y: Number(match[2]),
      }));
    }

Add a two-row quotation with the same Unit and Passenger. For columns 1 and 3, assert all AutoTable body cell text is empty, the matching output string occurs once, and its x/y equal the center of the first cell x/width and the full group's y/height. Convert the expected y to PDF coordinates with:

    const expectedY = pdf.internal.pageSize.getHeight() -
      (first.y + (last.y + last.height - first.y) / 2);

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

    npm.cmd run test -- src/lib/pdf.test.ts

Expected: FAIL because the current renderer leaves the first shared value inside AutoTable's first row instead of emitting one centered span label.

- [ ] **Step 3: Add the page-local merged-span renderer**

Above generatePdf in src/lib/pdf.ts, add the drawn-cell type and renderer:

    type DrawnQuoteCell = {
      pageNumber: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };

    function drawMergedQuoteSpan(doc: jsPDF, cells: DrawnQuoteCell[], value: string, pageNumber: number) {
      const pageCells = cells.filter((cell) => cell.pageNumber === pageNumber);
      if (!pageCells.length) return;

      const first = pageCells[0];
      const top = Math.min(...pageCells.map((cell) => cell.y));
      const bottom = Math.max(...pageCells.map((cell) => cell.y + cell.height));
      const height = bottom - top;

      doc.setFillColor(255, 255, 255);
      doc.rect(first.x, top, first.width, height, "F");
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.7);
      doc.rect(first.x, top, first.width, height, "S");
      doc.text(value, first.x + first.width / 2, top + height / 2, {
        align: "center",
        baseline: "middle",
      });
    }

Before calling autoTable, create these arrays:

    const sharedQuoteUnitCells: DrawnQuoteCell[] = [];
    const sharedQuotePassengerCells: DrawnQuoteCell[] = [];

Replace the current shared-cell hook behavior:

    didParseCell: (data) => {
      const sharedColumn =
        isQuote &&
        ((data.column.index === 1 && sharedQuoteUnit) ||
          (data.column.index === 3 && sharedQuotePassenger));
      if (sharedColumn && data.section === "body") data.cell.text = [];
    },
    didDrawCell: (data) => {
      if (!isQuote || data.section !== "body") return;
      const cell = {
        pageNumber: data.pageNumber,
        x: data.cell.x,
        y: data.cell.y,
        width: data.cell.width,
        height: data.cell.height,
      };
      if (data.column.index === 1 && sharedQuoteUnit) sharedQuoteUnitCells.push(cell);
      if (data.column.index === 3 && sharedQuotePassenger) sharedQuotePassengerCells.push(cell);
    },
    didDrawPage: (data) => {
      if (!isQuote) return;
      if (sharedQuoteUnit) drawMergedQuoteSpan(doc, sharedQuoteUnitCells, tableItems[0]?.unit || "", data.pageNumber);
      if (sharedQuotePassenger) drawMergedQuoteSpan(doc, sharedQuotePassengerCells, tableItems[0]?.passenger || "", data.pageNumber);
    },

The white fill intentionally removes AutoTable's individual borders and empty-cell backgrounds before drawing one merged outer border. Do not change quotation width, margin, or non-quotation configuration.

- [ ] **Step 4: Run the focused PDF tests to verify they pass**

Run:

    npm.cmd run test -- src/lib/pdf.test.ts

Expected: all PDF tests pass, including a single centered text operation for each shared Unit/Passenger span and blank AutoTable cells throughout the span.

- [ ] **Step 5: Run full regression and build checks**

Run:

    npm.cmd run test
    npm.cmd run build
    git diff --check

Expected: the full suite passes, the production build exits with code 0, and the diff has no whitespace errors.

- [ ] **Step 6: Commit the merged-cell renderer and records**

Run:

    git add -- src/lib/pdf.ts src/lib/pdf.test.ts docs/superpowers/plans/2026-07-24-quotation-pdf-merged-cells.md
    git commit -m "fix: center merged quotation PDF cells"

Expected: one focused commit completes Excel-like quotation PDF merging.
