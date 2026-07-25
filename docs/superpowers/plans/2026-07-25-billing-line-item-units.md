# Billing Line-Item Units Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give billing the same per-line-item Unit, repeated-value controls, and merged PDF-cell behavior as quotations while retaining billing-only header details.

**Architecture:** Normalize missing legacy Units into every row for both document types. Make DocumentEditor always manage Unit and Passenger synchronization at row level and derive the compatibility summary from rows. Generalize the existing quotation PDF table/merged-span renderer so billing uses the same five columns and layout, while each document type keeps its own heading.

**Tech Stack:** React 19, TypeScript 5, jsPDF 4, jspdf-autotable 5, Vitest 4, Testing Library.

## Global Constraints

- Billing removes the top-level Unit Used input and stores Unit inside every line-item JSON object.
- Billing keeps Date, Billed To, Driver, totals, payment details, and its signature behavior; it never renders or stores Requestor.
- Same passenger? and Same unit? apply to billing and quotation only for later row Passenger/Unit values, never Date, Destination, or Amount.
- Legacy records with an item missing unit fall back to the stored document unit in editor and direct PDF list rendering.
- Both document types persist an empty summary for no rows/all blank Units, a shared Unit when all non-empty Units match, and Multiple units otherwise.
- Both PDF tables use Date 70, Unit 75, Destination 140, Passenger 85, Amount 82 with 80pt left/right margins.
- Shared non-empty Unit/Passenger values form wrapped, vertically centered merged PDF spans, with page-local segments after page breaks.
- Use npm.cmd for project commands in this PowerShell workspace.

---

### Task 1: Normalize and edit billing Units per row

**Files:**
- Modify: src/lib/document-editor-data.ts:26-44
- Modify: src/lib/document-editor-data.test.ts:20-52
- Modify: src/components/DocumentEditor.tsx:8-201
- Modify: src/components/DocumentEditor.test.tsx:21-160

**Interfaces:**
- Consumes: DocRow records with a legacy document-level unit and Item objects with an optional unit.
- Produces: billing/quotation editor rows with unit strings, document-level compatibility summaries, and synchronized row inputs.

- [ ] **Step 1: Write failing legacy-billing and editor tests**

Add a data-mapping test that uses the existing billing row fixture and expects its item to gain the stored Sedan Unit:

    it("copies a legacy billing unit into every line item", () => {
      expect(toEditorInitial(row)?.items).toEqual([
        {
          date: "11-Jun-26",
          destination: "Makati",
          passenger: "A. Cruz",
          amount: 1200,
          unit: "Sedan",
        },
      ]);
    });

Add this editor test. It proves billing has the same controls and row inputs as quotation, has no Unit Used input, and persists its shared Unit summary:

    it("synchronizes billing passengers and units from the first row", async () => {
      render(
        <DocumentEditor
          docType="billing"
          initial={{
            billedTo: "Path Foundation",
            driver: "Teddy Dimate",
            items: [
              { date: "11-Jun-26", destination: "Makati", passenger: "A. Cruz", unit: "Toyota HiAce", amount: 1200 },
              { date: "12-Jun-26", destination: "Subic", passenger: "B. Reyes", unit: "Mitsubishi L300", amount: 900 },
            ],
          }}
        />,
      );

      expect(screen.queryByText("Unit Used")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Requestor")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("checkbox", { name: "Same passenger?" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Same unit?" }));
      fireEvent.change(screen.getByLabelText("Passenger 1"), { target: { value: "C. Santos" } });
      fireEvent.change(screen.getByLabelText("Unit 1"), { target: { value: "Toyota Commuter" } });
      fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(screen.getByLabelText("Passenger 2")).toHaveValue("C. Santos");
      expect(screen.getByLabelText("Passenger 2")).toBeDisabled();
      expect(screen.getByLabelText("Unit 2")).toHaveValue("Toyota Commuter");
      expect(screen.getByLabelText("Unit 2")).toBeDisabled();
      expect(screen.getByLabelText("Unit 3")).toHaveValue("Toyota Commuter");
      await waitFor(() => expect(db.saveDoc).toHaveBeenCalledTimes(1));
      expect(db.saveDoc.mock.calls[0][0]).toMatchObject({ doc_type: "billing", unit: "Toyota Commuter" });
      expect(JSON.parse(db.saveDoc.mock.calls[0][0].items_json)).toEqual(
        expect.arrayContaining([expect.objectContaining({ unit: "Toyota Commuter" })]),
      );
    });

- [ ] **Step 2: Run focused tests to verify they fail**

Run:

    npm.cmd run test -- src/lib/document-editor-data.test.ts src/components/DocumentEditor.test.tsx

Expected: the data test fails because billing rows are not normalized, and the editor test fails because billing lacks row Units and same-value controls.

- [ ] **Step 3: Normalize both document types and generalize editor behavior**

In src/lib/document-editor-data.ts, normalize every stored item, not quotation rows only:

    const normalizedItems = items.map((item) => ({ ...item, unit: item.unit ?? doc.unit }));

In src/components/DocumentEditor.tsx, give all new rows a Unit and replace quotation-only summary behavior:

    function emptyItem(_docType: DocType, patch: Partial<Item> = {}): Item {
      return {
        date: "",
        destination: "",
        passenger: "",
        unit: "",
        amount: 0,
        ...patch,
      };
    }

    function documentUnitSummary(items: Item[]): string {
      if (!items.length || !items.some((item) => item.unit)) return "";
      const firstUnit = items[0].unit || "";
      return firstUnit && items.every((item) => item.unit === firstUnit) ? firstUnit : "Multiple units";
    }

Initialize samePassenger and sameUnit with rowsShare for either document type. Remove the top-level unit state and Unit Used field. In setItem, propagate first-row Passenger/Unit when its corresponding same checkbox is enabled without a document-type condition. Use the same rule in addRow:

    passenger: samePassenger ? previous[0]?.passenger || "" : "",
    unit: sameUnit ? previous[0]?.unit || "" : "",

Show both checkboxes and the Unit table column for billing and quotations. Disable later Passenger/Unit inputs whenever their matching checkbox is active. In buildInput, always pass documentUnitSummary(normalizedItems) as unit; leave billing Requestor absent from the rendered controls and saved value unchanged as an empty string.

- [ ] **Step 4: Run focused tests to verify they pass**

Run:

    npm.cmd run test -- src/lib/document-editor-data.test.ts src/components/DocumentEditor.test.tsx

Expected: both files pass, proving legacy billing fallback, row Unit persistence, billing synchronization, and no billing Requestor/Unit Used controls.

- [ ] **Step 5: Commit the compatible billing editor behavior**

Run:

    git add -- src/lib/document-editor-data.ts src/lib/document-editor-data.test.ts src/components/DocumentEditor.tsx src/components/DocumentEditor.test.tsx
    git commit -m "feat: add billing line-item unit controls"

Expected: one commit updates the data and editor contract without changing PDF generation.

### Task 2: Use per-row Units and merged spans in billing PDFs

**Files:**
- Modify: src/lib/pdf.ts:145-246
- Modify: src/lib/pdf.test.ts:96-285

**Interfaces:**
- Consumes: PdfInput items with unit values or legacy items whose Unit is absent.
- Produces: billing and quotation tables with identical five-column geometry and shared Unit/Passenger spans, while preserving document-specific headings.

- [ ] **Step 1: Write failing billing PDF tests**

Add a billing regression that supplies two same-Unit/same-Passenger rows and asserts the five headers, fixed geometry, merged body cells, and absent top-level Unit Used label:

    it("renders billing Units from line items with shared merged spans", async () => {
      const pdf = await generatePdf({
        ...input,
        docType: "billing",
        unit: "Toyota HiAce",
        items: [
          { date: "2026-06-11", unit: "Toyota HiAce", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
          { date: "2026-06-12", unit: "Toyota HiAce", destination: "Olongapo", passenger: "A. Cruz", amount: 900 },
        ],
      });
      const table = generatedTable(pdf);

      expect([0, 1, 2, 3, 4].map((index) => table.head[0].cells[index].text[0])).toEqual([
        "DATE", "UNIT", "DESTINATION", "PASSENGER", "AMOUNT",
      ]);
      expect([0, 1, 2, 3, 4].map((index) => table.head[0].cells[index].width)).toEqual([
        70, 75, 140, 85, 82,
      ]);
      expect(table.body.map((row) => row.cells[1].text)).toEqual([[], []]);
      expect(table.body.map((row) => row.cells[3].text)).toEqual([[], []]);
      expect(textPositions(pdf.output(), "Toyota HiAce")).toHaveLength(1);
      expect(textPositions(pdf.output(), "A. Cruz")).toHaveLength(1);
      expect(pdf.output()).not.toContain("(Unit Used: Toyota HiAce) Tj");
      expect(pdf.output()).not.toContain("(Requestor:) Tj");
    });

Add a legacy billing direct-render assertion using item objects without unit and document unit Toyota HiAce. Assert that the generated billing Unit text occurs once.

- [ ] **Step 2: Run the focused PDF test to verify it fails**

Run:

    npm.cmd run test -- src/lib/pdf.test.ts

Expected: FAIL because billing still has four columns and a document-level Unit Used label.

- [ ] **Step 3: Generalize table data, headings, and merge hooks**

In src/lib/pdf.ts, replace quotation-only table data/merge state with document-agnostic values:

    const tableItems = input.items.map((item) => ({ ...item, unit: item.unit ?? input.unit }));
    const sharedUnit = rowsSharePdfValue(tableItems, "unit");
    const sharedPassenger = rowsSharePdfValue(tableItems, "passenger");
    const sharedUnitCells: DrawnQuoteCell[] = [];
    const sharedPassengerCells: DrawnQuoteCell[] = [];
    const head = [["DATE", "UNIT", "DESTINATION", "PASSENGER", "AMOUNT"]];
    const body = tableItems.map((item) => [
      item.date,
      item.unit || "",
      item.destination,
      item.passenger,
      money(item.amount),
    ]);

Use the fixed five-column configuration for every autoTable call:

    margin: { left: 80, right: 80 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 75 },
      2: { cellWidth: 140, halign: "center" },
      3: { cellWidth: 85 },
      4: { cellWidth: 82 },
    },

Make didParseCell, didDrawCell, and didDrawPage use sharedUnit/sharedPassenger for columns 1/3 in both document types. Reuse quoteSharedColumnWidth, quoteSpanLines, minCellHeight reservation, and drawMergedQuoteSpan unchanged because their geometry is now shared by billing and quotation.

Remove the billing Unit Used text line but preserve Billed To, DETAILS: CAR RENTAL SERVICES, and Driver. Do not add Requestor anywhere in the billing branch.

- [ ] **Step 4: Run focused PDF tests to verify they pass**

Run:

    npm.cmd run test -- src/lib/pdf.test.ts

Expected: all PDF tests pass, proving billing row Unit rendering, legacy fallback, true shared spans, fixed columns, and unchanged quotation behavior.

- [ ] **Step 5: Run full verification**

Run:

    npm.cmd run test
    npm.cmd run build
    git diff --check

Expected: all test files pass, the production build exits with code 0, and the diff has no whitespace errors.

- [ ] **Step 6: Commit the billing PDF behavior and plan**

Run:

    git add -- src/lib/pdf.ts src/lib/pdf.test.ts docs/superpowers/plans/2026-07-25-billing-line-item-units.md
    git commit -m "feat: render billing units per line item"

Expected: one commit completes billing row and PDF parity.
