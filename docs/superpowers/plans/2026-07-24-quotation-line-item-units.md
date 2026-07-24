# Quotation Line-Item Units Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let quotations assign a Unit to every line item, synchronize repeated Passenger and Unit values through editor controls, and render a balanced fixed-width PDF table.

**Architecture:** Extend the JSON-only `Item` shape with an optional `unit` for legacy parsing, then normalize quotation items to include a value when they enter the editor. The quotation editor owns the transient synchronization checkboxes and persists the resulting row values; the quotation PDF derives merged Passenger/Unit columns from those persisted values, so list previews and downloads need no separate checkbox state.

**Tech Stack:** React 19, TypeScript 5, sql.js, jsPDF 4, jspdf-autotable 5, Vitest 4, Testing Library.

## Global Constraints

- Billing keeps its existing document-level `Unit Used` field and PDF layout.
- Quotation removes the document-level `Unit Requested` input and stores Unit inside each line item JSON object.
- Existing quotation rows without `item.unit` receive the saved document-level `unit` value when opened for editing or rendered directly from a list preview.
- `Same passenger?` and `Same unit?` synchronize later rows from the first row and do not apply to Date, Destination, or Amount.
- A quotation summary is empty when every row Unit is blank, a shared Unit when all non-empty row Units match, and `Multiple units` otherwise.
- Quotation PDF tables use 80pt left and right margins and fixed widths: Date 70, Unit 75, Destination 140, Passenger 85, Amount 82.
- Use `npm.cmd` for project commands in this PowerShell workspace.

---

### Task 1: Normalize item-level Units and legacy quotation data

**Files:**
- Modify: `src/lib/db.ts:24-29`
- Modify: `src/lib/document-editor-data.ts:3-46`
- Modify: `src/lib/document-editor-data.test.ts:5-50`

**Interfaces:**
- Consumes: stored `DocRow` records with legacy `unit` and `items_json` values.
- Produces: `Item` objects with `unit?: string`, and `toEditorInitial(doc)` values whose quotation items each have a normalized Unit.

- [ ] **Step 1: Write the failing legacy-quotation normalization test**

Add this test to `src/lib/document-editor-data.test.ts`:

```ts
  it("copies a legacy quotation unit into every line item", () => {
    const quotation: DocRow = {
      ...row,
      doc_type: "quotation",
      unit: "Toyota HiAce",
      items_json: JSON.stringify([
        { date: "11-Jun-26", destination: "Makati", passenger: "A. Cruz", amount: 1200 },
        { date: "12-Jun-26", destination: "Subic", passenger: "A. Cruz", amount: 900 },
      ]),
    };

    expect(toEditorInitial(quotation)?.items).toEqual([
      { date: "11-Jun-26", destination: "Makati", passenger: "A. Cruz", amount: 1200, unit: "Toyota HiAce" },
      { date: "12-Jun-26", destination: "Subic", passenger: "A. Cruz", amount: 900, unit: "Toyota HiAce" },
    ]);
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm.cmd run test -- src/lib/document-editor-data.test.ts
```

Expected: the new test fails because legacy JSON items do not gain `unit`.

- [ ] **Step 3: Add the optional item Unit and normalize quotation items**

Extend `Item` in `src/lib/db.ts`:

```ts
export interface Item {
  date: string;
  destination: string;
  passenger: string;
  unit?: string;
  amount: number;
}
```

In `src/lib/document-editor-data.ts`, accept an absent legacy Unit but reject a non-string one, then normalize only quotations before returning the editor data:

```ts
    (item.unit === undefined || typeof item.unit === "string") &&
    typeof item.amount === "number" &&
    Number.isFinite(item.amount)
```

```ts
  const normalizedItems = doc.doc_type === "quotation"
    ? items.map((item) => ({ ...item, unit: item.unit ?? doc.unit }))
    : items;

  return {
    date: doc.doc_date,
    billedTo: doc.billed_to,
    unit: doc.unit,
    driver: doc.driver,
    requestor: doc.requestor,
    items: normalizedItems,
  };
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```powershell
npm.cmd run test -- src/lib/document-editor-data.test.ts
```

Expected: every data-mapping test passes, including the legacy quotation case.

- [ ] **Step 5: Commit the compatible item shape**

Run:

```powershell
git add -- src/lib/db.ts src/lib/document-editor-data.ts src/lib/document-editor-data.test.ts
git commit -m "feat: normalize quotation line-item units"
```

Expected: one commit adds only compatibility-safe item-unit parsing and mapping.

### Task 2: Add quotation row Units and same-value editor controls

**Files:**
- Modify: `src/components/DocumentEditor.tsx:8-155`
- Modify: `src/components/DocumentEditor.test.tsx:25-63`

**Interfaces:**
- Consumes: normalized quotation `Item[]` from Task 1.
- Produces: quotation save/preview input with per-row Units and a document-level Unit summary (`""`, one shared Unit, or `"Multiple units"`).

- [ ] **Step 1: Write failing quotation editor behavior tests**

Add these tests to `src/components/DocumentEditor.test.tsx`:

```tsx
  it("synchronizes quotation passengers and units from the first row", () => {
    render(
      <DocumentEditor
        docType="quotation"
        initial={{
          date: "14 June 2026",
          requestor: "Path Foundation",
          items: [
            { date: "11-Jun-26", destination: "Makati", passenger: "A. Cruz", unit: "Toyota HiAce", amount: 1200 },
            { date: "12-Jun-26", destination: "Subic", passenger: "B. Reyes", unit: "Mitsubishi L300", amount: 900 },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Same passenger?" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Same unit?" }));
    fireEvent.change(screen.getByLabelText("Passenger 1"), { target: { value: "C. Santos" } });
    fireEvent.change(screen.getByLabelText("Unit 1"), { target: { value: "Toyota Commuter" } });
    fireEvent.click(screen.getByRole("button", { name: /add row/i }));

    expect(screen.getByLabelText("Passenger 2")).toHaveValue("C. Santos");
    expect(screen.getByLabelText("Passenger 2")).toBeDisabled();
    expect(screen.getByLabelText("Unit 2")).toHaveValue("Toyota Commuter");
    expect(screen.getByLabelText("Unit 2")).toBeDisabled();
    expect(screen.getByLabelText("Passenger 3")).toHaveValue("C. Santos");
    expect(screen.getByLabelText("Unit 3")).toHaveValue("Toyota Commuter");
  });

  it("saves a multi-unit quotation using its line-item units", async () => {
    render(
      <DocumentEditor
        docType="quotation"
        initial={{
          items: [
            { date: "11-Jun-26", destination: "Makati", passenger: "A. Cruz", unit: "Toyota HiAce", amount: 1200 },
            { date: "12-Jun-26", destination: "Subic", passenger: "B. Reyes", unit: "Mitsubishi L300", amount: 900 },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(db.saveDoc).toHaveBeenCalledTimes(1));
    const saved = db.saveDoc.mock.calls[0][0];
    expect(saved).toMatchObject({ doc_type: "quotation", unit: "Multiple units" });
    expect(JSON.parse(saved.items_json)).toEqual([
      expect.objectContaining({ unit: "Toyota HiAce" }),
      expect.objectContaining({ unit: "Mitsubishi L300" }),
    ]);
  });
```

- [ ] **Step 2: Run the editor test file to verify the new tests fail**

Run:

```powershell
npm.cmd run test -- src/components/DocumentEditor.test.tsx
```

Expected: tests fail because quotations still expose a top-level Unit Requested field and have no same-value controls or row Unit inputs.

- [ ] **Step 3: Implement per-row quotation Units and synchronization**

Make `emptyItem` accept the document type and an optional patch so billing
line-item JSON remains unchanged, then introduce a summary helper:

```ts
function emptyItem(docType: DocType, patch: Partial<Item> = {}): Item {
  return {
    date: "",
    destination: "",
    passenger: "",
    ...(docType === "quotation" ? { unit: "" } : {}),
    amount: 0,
    ...patch,
  };
}

function quotationUnitSummary(items: Item[]): string {
  if (!items.length) return "";
  const firstUnit = items[0].unit || "";
  return firstUnit && items.every((item) => item.unit === firstUnit) ? firstUnit : "Multiple units";
}
```

For quotations, initialize `samePassenger` and `sameUnit` from whether every row has the same non-empty corresponding value. When either checkbox changes from off to on, copy the first row's corresponding field to every row. When the first row changes while its checkbox is on, copy that new value to every later row. `addRow` must carry the synchronized first-row values. The second and later inputs for an active synchronized field must be disabled.

Initialize and add rows with the document type:

```ts
const [items, setItems] = useState<Item[]>(initial?.items ?? [emptyItem(docType)]);
const addRow = () => setItems((previous) => [
  ...previous,
  emptyItem(docType, {
    passenger: samePassenger ? previous[0]?.passenger || "" : "",
    ...(docType === "quotation" ? { unit: sameUnit ? previous[0]?.unit || "" : "" } : {}),
  }),
]);
```

Use the following helpers so the synchronization behavior is isolated from the
rendering code:

```ts
function rowsShare(items: Item[], field: "passenger" | "unit"): boolean {
  const first = items[0]?.[field] || "";
  return Boolean(first) && items.every((item) => item[field] === first);
}

function synchronizeRows(items: Item[], field: "passenger" | "unit"): Item[] {
  const value = items[0]?.[field] || "";
  return items.map((item) => ({ ...item, [field]: value }));
}
```

In the quotation table render, use the exact new header and accessible inputs:

```tsx
{docType === "quotation" && <th className="p-2 text-left w-32">Unit</th>}
// directly after the Date cell for each quotation row
<td className="p-1">
  <input
    aria-label={`Unit ${i + 1}`}
    className="input"
    value={it.unit || ""}
    disabled={sameUnit && i > 0}
    onChange={(event) => setItem(i, { unit: event.target.value })}
  />
</td>
// Passenger input in every row
<input
  aria-label={`Passenger ${i + 1}`}
  className="input"
  value={it.passenger}
  disabled={samePassenger && i > 0}
  onChange={(event) => setItem(i, { passenger: event.target.value })}
/>
```

Render the top-level Unit field only for billing:

```tsx
{docType === "billing" && (
  <Field label="Unit Used">
    <input className="input" value={unit} onChange={(event) => setUnit(event.target.value)} />
  </Field>
)}
```

For quotation rows, add a Unit column between Date and Destination, plus the two checkbox labels next to the Line Items heading. Use the row index to provide stable `aria-label` values for Passenger and Unit inputs. During save and PDF preview, pass `quotationUnitSummary(items)` as `unit` for quotations; billing continues using the existing `unit` state.

- [ ] **Step 4: Run editor tests to verify the behavior passes**

Run:

```powershell
npm.cmd run test -- src/components/DocumentEditor.test.tsx
```

Expected: editor tests pass, showing Unit per quotation row, same-value synchronization, disabled follower fields, new-row defaults, and `Multiple units` persistence.

- [ ] **Step 5: Commit the quotation editor behavior**

Run:

```powershell
git add -- src/components/DocumentEditor.tsx src/components/DocumentEditor.test.tsx
git commit -m "feat: add quotation line-item unit controls"
```

Expected: one commit adds the quotation-only editor behavior without changing billing controls.

### Task 3: Render balanced per-row Unit and Passenger columns in PDFs

**Files:**
- Modify: `src/lib/pdf.ts:15-185`
- Modify: `src/lib/pdf.test.ts:21-149`

**Interfaces:**
- Consumes: quotation `Item[]` whose rows have `unit` values, including legacy-normalized values from Task 1.
- Produces: equal-margin quotation tables with Date, Unit, Destination, Passenger, and Amount columns; Unit and Passenger merge only when all rows have a common non-empty value.

- [ ] **Step 1: Write failing quotation PDF layout tests**

Add these tests to `src/lib/pdf.test.ts`, reusing the existing `generatedTable`
helper:

```ts
  it("uses balanced fixed quotation columns and merges shared values only", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
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
    expect(table.head[0].cells[0].x).toBe(80);
    expect(table.head[0].cells[4].x + table.head[0].cells[4].width).toBe(532);
    expect(table.body[1].cells[1].text).toEqual([""]);
    expect(table.body[1].cells[3].text).toEqual([""]);
    expect(table.body[1].cells[0].text).toEqual(["2026-06-12"]);
    expect(table.body[1].cells[2].text).toEqual(["Olongapo"]);
    expect(table.body[1].cells[4].text).toEqual(["PHP 900.00"]);
  });

  it("keeps differing quotation units and passengers in their own rows", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      items: [
        { date: "2026-06-11", unit: "Toyota HiAce", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
        { date: "2026-06-12", unit: "Mitsubishi L300", destination: "Olongapo", passenger: "B. Reyes", amount: 900 },
      ],
    });
    const table = generatedTable(pdf);

    expect(table.body[1].cells[1].text).toEqual(["Mitsubishi L300"]);
    expect(table.body[1].cells[3].text).toEqual(["B. Reyes"]);
  });
```

- [ ] **Step 2: Run the focused PDF test to verify it fails**

Run:

```powershell
npm.cmd run test -- src/lib/pdf.test.ts
```

Expected: the tests fail because the current table uses a shared `input.unit`, puts Unit in the final column, has unequal margins, and lacks conditional Passenger merging.

- [ ] **Step 3: Implement fixed quote table data, geometry, and conditional merges**

In `src/lib/pdf.ts`, create quotation rows in the specified order:

```ts
const body = input.items.map((item) =>
  isQuote
    ? [item.date, item.unit || "", item.destination, item.passenger, money(item.amount)]
    : [item.date, item.destination, item.passenger, money(item.amount)],
);
```

Use the matching quotation header and margin/column configuration:

```ts
const head = isQuote
  ? [["DATE", "UNIT", "DESTINATION", "PASSENGER", "AMOUNT"]]
  : [["DATE", "DESTINATION", "PASSENGER", "AMOUNT"]];

margin: isQuote ? { left: 80, right: 80 } : { left: marginL, right: marginR },
columnStyles: isQuote
  ? {
      0: { cellWidth: 70 },
      1: { cellWidth: 75 },
      2: { cellWidth: 140, halign: "center" },
      3: { cellWidth: 85 },
      4: { cellWidth: 82 },
    }
  : {
      0: { cellWidth: 80 },
      1: { cellWidth: 230, halign: "center" },
      2: { cellWidth: 90 },
      3: { cellWidth: 95 },
    },
```

Add a small helper that returns true only when the table has at least one row
and every row shares the same non-empty `unit` or `passenger`:

```ts
function rowsSharePdfValue(items: Item[], field: "unit" | "passenger"): boolean {
  const first = items[0]?.[field] || "";
  return Boolean(first) && items.every((item) => item[field] === first);
}
```

Use `sharedQuoteUnit` and `sharedQuotePassenger` values created from that
helper. In `didParseCell`, blank subsequent Unit cells only when
`data.column.index === 1 && sharedQuoteUnit`, and subsequent Passenger cells
only when `data.column.index === 3 && sharedQuotePassenger`. In
`didDrawCell`, paint the internal horizontal border white using the existing
`doc.line` technique only for those same two conditions. Leave Date,
Destination, and Amount untouched.

- [ ] **Step 4: Run the focused PDF test to verify it passes**

Run:

```powershell
npm.cmd run test -- src/lib/pdf.test.ts
```

Expected: all PDF tests pass, including fixed equal margins, row-specific Units, and conditional Unit/Passenger merges.

- [ ] **Step 5: Run full regression checks**

Run:

```powershell
npm.cmd run test
npm.cmd run build
```

Expected: all test files pass and the Vite production build exits successfully.

- [ ] **Step 6: Commit the PDF layout change and plan**

Run:

```powershell
git add -- src/lib/pdf.ts src/lib/pdf.test.ts docs/superpowers/plans/2026-07-24-quotation-line-item-units.md
git commit -m "feat: render quotation units per line item"
```

Expected: one commit completes the quotation PDF behavior and records the implementation plan.
