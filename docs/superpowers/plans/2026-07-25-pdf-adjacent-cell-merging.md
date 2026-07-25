# PDF Adjacent Cell Merging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge only contiguous non-empty matching Unit and Passenger values in Billing and Quotation PDF tables.

**Architecture:** Replace the current whole-column shared-value check with a pure helper that returns row-indexed adjacent runs for either column. PDF table hooks will clear, collect, and draw cells only when their row belongs to one of those runs; the existing span renderer keeps each visible page portion vertically centered.

**Tech Stack:** TypeScript, jsPDF, jspdf-autotable, Vitest.

## Global Constraints

- Change PDF rendering only in `src/lib/pdf.ts`; do not modify editor inputs, saved items, or same-value controls.
- Evaluate Unit and Passenger runs independently.
- A run needs at least two consecutive rows with exactly equal stored values that are non-empty after trimming whitespace.
- Never merge equal values separated by a different value or a blank row.
- Preserve the current per-page span rendering, table widths, Billing totals, and Billing signature behavior.

---

### Task 1: Add adjacent-run PDF regression coverage

**Files:**

- Modify: `src/lib/pdf.test.ts`

**Interfaces:**

- Consumes: `generatePdf(input: PdfInput): Promise<jsPDF>`.
- Produces: failing behavior tests for adjacent Unit and Passenger merges in Billing and Quotation PDFs.

- [ ] **Step 1: Write the failing test**

Add a parametrized test after the existing Billing shared-span test. Give it rows that produce an adjacent Unit run, a longer independent Passenger run, non-adjacent repeated values, and blank cells:

```ts
it.each(["billing", "quotation"] as const)("merges only adjacent non-empty Unit and Passenger cells in %s PDFs", async (docType) => {
  const pdf = await generatePdf({
    ...input,
    docType,
    items: [
      { date: "2026-06-11", unit: "Toyota HiAce", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
      { date: "2026-06-12", unit: "Toyota HiAce", destination: "Olongapo", passenger: "A. Cruz", amount: 900 },
      { date: "2026-06-13", unit: "Mitsubishi L300", destination: "Manila", passenger: "A. Cruz", amount: 1100 },
      { date: "2026-06-14", unit: "Toyota HiAce", destination: "Subic", passenger: "B. Reyes", amount: 1000 },
      { date: "2026-06-15", unit: "", destination: "Subic", passenger: "", amount: 1000 },
      { date: "2026-06-16", unit: "Toyota HiAce", destination: "Subic", passenger: "B. Reyes", amount: 1000 },
    ],
  });
  const table = generatedTable(pdf);
  const output = pdf.output();

  expect(table.body.slice(0, 2).map((row) => row.cells[1].text)).toEqual([[], []]);
  expect(table.body.slice(0, 3).map((row) => row.cells[3].text)).toEqual([[], [], []]);
  expect(table.body[2].cells[1].text).toEqual(["Mitsubishi", "L300"]);
  expect(table.body[3].cells[1].text).toEqual(["Toyota", "HiAce"]);
  expect(table.body[3].cells[3].text).toEqual(["B. Reyes"]);
  expect(table.body[5].cells[1].text).toEqual(["Toyota", "HiAce"]);
  expect(table.body[5].cells[3].text).toEqual(["B. Reyes"]);
  expect(textPositions(output, "Toyota HiAce")).toHaveLength(3);
  expect(textPositions(output, "A. Cruz")).toHaveLength(1);
  expect(textPositions(output, "B. Reyes")).toHaveLength(2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd run test -- src/lib/pdf.test.ts`

Expected: FAIL because the current whole-column comparison treats every row in each column as unshared when any row differs, so the first adjacent cells retain their normal text.

- [ ] **Step 3: Keep the red checkpoint uncommitted**

Do not commit deliberately failing code to `master`. Keep the red result as execution evidence and proceed immediately to the minimal implementation.

### Task 2: Render adjacent runs as PDF merged spans

**Files:**

- Modify: `src/lib/pdf.ts:67-106`
- Modify: `src/lib/pdf.ts:155-235`
- Test: `src/lib/pdf.test.ts`

**Interfaces:**

- Consumes: `Item[]` with Unit/Passenger values and jsPDF-AutoTable hook data.
- Produces: `adjacentPdfValueRuns(items, field)` returning row-indexed merge runs and `pdfRunByRow(runs)` to locate the run owning a body cell.

- [ ] **Step 1: Replace the all-rows helper with adjacent-run helpers**

Replace `rowsSharePdfValue` with a run model that is independent of document type:

```ts
type PdfMergedCellRun = {
  value: string;
  startRow: number;
  endRow: number;
  cells: DrawnQuoteCell[];
};

function adjacentPdfValueRuns(items: Item[], field: "unit" | "passenger"): PdfMergedCellRun[] {
  const runs: PdfMergedCellRun[] = [];
  let startRow = 0;

  while (startRow < items.length) {
    const value = items[startRow]?.[field] ?? "";
    if (!value.trim()) {
      startRow += 1;
      continue;
    }
    let endRow = startRow;
    while (endRow + 1 < items.length && (items[endRow + 1]?.[field] ?? "") === value) endRow += 1;
    if (endRow > startRow) runs.push({ value, startRow, endRow, cells: [] });
    startRow = endRow + 1;
  }
  return runs;
}

function pdfRunByRow(runs: PdfMergedCellRun[]): Map<number, PdfMergedCellRun> {
  const byRow = new Map<number, PdfMergedCellRun>();
  for (const run of runs) {
    for (let row = run.startRow; row <= run.endRow; row += 1) byRow.set(row, run);
  }
  return byRow;
}
```

- [ ] **Step 2: Wire runs into the AutoTable hooks**

Create Unit and Passenger run maps after `tableItems`, then resolve a run only for the matching body column and `data.row.index`. In `didParseCell`, reserve height and clear `data.cell.text` only for a resolved run. In `didDrawCell`, append geometry to that run's `cells`. In `didDrawPage`, draw every Unit and Passenger run using its own `value` and `cells`:

```ts
const unitRunsByRow = pdfRunByRow(adjacentPdfValueRuns(tableItems, "unit"));
const passengerRunsByRow = pdfRunByRow(adjacentPdfValueRuns(tableItems, "passenger"));

function runForPdfCell(column: number, row: number) {
  if (column === 1) return unitRunsByRow.get(row);
  if (column === 3) return passengerRunsByRow.get(row);
  return undefined;
}

for (const run of [...new Set(unitRunsByRow.values()), ...new Set(passengerRunsByRow.values())]) {
  drawMergedQuoteSpan(doc, run.cells, run.value, data.pageNumber);
}
```

Continue to use `quoteSpanLines`, `quoteSharedColumnWidth`, and `drawMergedQuoteSpan` so line wrapping, borders, and vertical centering remain unchanged.

- [ ] **Step 3: Run the focused test suite to verify it passes**

Run: `npm.cmd run test -- src/lib/pdf.test.ts`

Expected: all `src/lib/pdf.test.ts` tests pass, including the new Billing and Quotation adjacent-run cases.

- [ ] **Step 4: Run formatting-safety checks**

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.

- [ ] **Step 5: Commit the implementation**

```bash
git add -- src/lib/pdf.ts src/lib/pdf.test.ts docs/superpowers/plans/2026-07-25-pdf-adjacent-cell-merging.md
git commit -m "feat: merge adjacent PDF table cells"
```

Expected: one focused commit containing the adjacent-run implementation, regression tests, and plan.
