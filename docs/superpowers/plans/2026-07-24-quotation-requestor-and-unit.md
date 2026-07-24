# Quotation Requestor and Unit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the quotation requestor beneath the quotation heading and use the rightmost quotation table column for the requested vehicle unit.

**Architecture:** Keep the existing quotation data model and editor unchanged. Update only the quotation branch of `generatePdf`: render requestor metadata in the header, rename the existing merged rightmost table column to `UNIT`, and populate it with the existing `input.unit` value. Extend the PDF unit test suite to assert the resulting document text.

**Tech Stack:** TypeScript, jsPDF 4, jspdf-autotable 5, Vitest 4, Vite 8.

## Global Constraints

- Do not change the database schema, saved `requestor`/`unit` fields, or quotation editor inputs.
- Billing PDF rendering, including its optional ignored signature, must remain unchanged.
- Quotation PDFs must show `Requestor: <requestor>` below `QUOTATION REQUEST`.
- The quotation table's final column header must be `UNIT`, with the unit displayed once across the quotation table body.
- Use `npm.cmd` for project commands in this PowerShell workspace.

---

### Task 1: Update quotation PDF rendering and coverage

**Files:**
- Modify: `src/lib/pdf.ts:105-176`
- Modify: `src/lib/pdf.test.ts:57-63`

**Interfaces:**
- Consumes: `generatePdf(input: PdfInput): Promise<jsPDF>`, where `PdfInput` already supplies `docType`, `requestor`, `unit`, and `items`.
- Produces: quotation PDFs whose metadata and table headings reflect the existing `requestor` and `unit` fields without changing their types or persistence.

- [ ] **Step 1: Write the failing quotation-layout test**

Add the following test after the existing quotation signature test in `src/lib/pdf.test.ts`:

```ts
  it("renders a quotation requestor above a merged unit column", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      requestor: "Path Foundation",
      unit: "Toyota HiAce",
      items: [
        { date: "2026-06-11", destination: "Subic", passenger: "2", amount: 1200 },
        { date: "2026-06-12", destination: "Olongapo", passenger: "3", amount: 900 },
      ],
    });

    const output = pdf.output();
    expect(output).toContain("Requestor: Path Foundation");
    expect(output).toContain("(UNIT) Tj");
    expect(output).toContain("Toyota HiAce");
    expect(output).not.toContain("(Requestor) Tj");
    expect(output).not.toContain("Unit Requested:");
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm.cmd run test -- src/lib/pdf.test.ts
```

Expected: the new test fails because the current PDF includes `Unit Requested:` in its header and the table header is still `Requestor`.

- [ ] **Step 3: Implement the minimal quotation-only PDF change**

In the quotation branch in `src/lib/pdf.ts`, replace the current unit header line with the requestor line:

```ts
  } else {
    doc.text("QUOTATION REQUEST", marginL, y); y += lineGap;
    doc.text(`Requestor: ${input.requestor || ""}`, marginL, y); y += 24;
  }
```

Change the quotation table header and replace the existing Requestor-specific merged-column callbacks with Unit-specific equivalents:

```ts
  const head = isQuote
    ? [["DATE", "DESTINATION", "PASSENGER", "AMOUNT", "UNIT"]]
    : [["DATE", "DESTINATION", "PASSENGER", "AMOUNT"]];

  // ...retain the quotation body as [...base, ""] so the fifth column is populated in didParseCell.

    didParseCell: (data) => {
      if (isQuote && data.section === "body" && data.column.index === 4) {
        if (data.row.index === 0) {
          data.cell.text = [input.unit || ""];
          data.cell.styles.valign = "middle";
        } else {
          data.cell.text = [""];
        }
      }
    },
    didDrawCell: (data) => {
      if (isQuote && data.section === "body" && data.column.index === 4 && data.row.index > 0) {
        const { x, y, width } = data.cell;
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1);
        doc.line(x + 0.5, y, x + width - 0.5, y);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.7);
      }
    },
```

Remove the now-empty `willDrawCell` callback. Rename nearby comments from `Requestor` to `Unit` so they describe the new behavior.

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```powershell
npm.cmd run test -- src/lib/pdf.test.ts
```

Expected: `src/lib/pdf.test.ts` passes, with only the environment-dependent local-signature test skipped when the ignored `signature/` directory is absent.

- [ ] **Step 5: Run regression checks**

Run:

```powershell
npm.cmd run test
npm.cmd run build
```

Expected: all test files pass and the Vite production build exits successfully.

- [ ] **Step 6: Commit the completed change**

Run:

```powershell
git add -- src/lib/pdf.ts src/lib/pdf.test.ts docs/superpowers/plans/2026-07-24-quotation-requestor-and-unit.md
git commit -m "feat: move quotation requestor above unit column"
```

Expected: one commit contains the quotation PDF behavior, regression test, and implementation plan.
