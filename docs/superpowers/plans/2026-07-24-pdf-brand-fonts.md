# PDF Brand Fonts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the PDF header in Britannic Bold and render the footer in bold, non-italic Times.

**Architecture:** The existing public Britannic TTF remains a static asset. `generatePdf` will load and cache the font, register it with jsPDF, then create the document. Its callers will await generation while keeping preview windows opened synchronously from the user click to preserve popup behavior.

**Tech Stack:** React, TypeScript, jsPDF, jsPDF-AutoTable, Vitest.

## Global Constraints

- Apply the new fonts only to the generated billing and quotation PDFs.
- Use `public/Britannic Bold Regular.ttf` for the header brand name.
- Use jsPDF's built-in `times` `bold` font for every footer line; do not use italics.
- Preserve all other layout and document content.

---

### Task 1: Cover PDF font selection

**Files:**
- Create: `src/lib/pdf.test.ts`
- Modify: `src/lib/pdf.ts`

**Interfaces:**
- Consumes: `generatePdf(input: PdfInput): Promise<jsPDF>`.
- Produces: unit coverage for custom-font registration plus the header and footer `setFont` calls.

- [ ] **Step 1: Write the failing test**

Mock the jsPDF constructor and `jspdf-autotable`; stub `fetch` with a successful `ArrayBuffer` response. Have the fake PDF record `addFileToVFS`, `addFont`, and `setFont` calls. Assert that `await generatePdf(input)` registers `Britannic Bold Regular.ttf`, selects the registered `Britannic Bold` `normal` face for the header, and selects `times` `bold` for all footer text.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd run test -- src/lib/pdf.test.ts`

Expected: FAIL because `generatePdf` is synchronous and does not register the custom font.

- [ ] **Step 3: Implement the minimal PDF changes**

In `src/lib/pdf.ts`, add a module-level `Promise<string> | undefined` cache for the Britannic font data. Fetch `/Britannic%20Bold%20Regular.ttf`, convert its `ArrayBuffer` to base64, and return it. Change the public generator signature to `export async function generatePdf(input: PdfInput): Promise<jsPDF>`. Register the data with:

```ts
doc.addFileToVFS("Britannic Bold Regular.ttf", britannicBoldBase64);
doc.addFont("Britannic Bold Regular.ttf", "Britannic Bold", "normal");
doc.setFont("Britannic Bold", "normal");
```

Then set the footer with `doc.setFont("times", "bold")` before all three footer lines.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm.cmd run test -- src/lib/pdf.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/pdf.ts src/lib/pdf.test.ts public/Britannic\ Bold\ Regular.ttf
git commit -m "feat: apply brand fonts to generated PDFs"
```

### Task 2: Await PDF generation in document actions

**Files:**
- Modify: `src/components/DocumentEditor.tsx`
- Modify: `src/components/DocList.tsx`

**Interfaces:**
- Consumes: `generatePdf(input: PdfInput): Promise<jsPDF>` from `src/lib/pdf.ts`.
- Produces: preview and download actions that work after asynchronous font loading.

- [ ] **Step 1: Update the failing consumers**

Change the preview and download functions in both files to `async`. For previews, open `window.open("", "_blank")` before awaiting `generatePdf`, then navigate that already-opened window to `pdf.output("bloburl")`. For downloads, await `generatePdf` before calling `pdf.save(...)`.

- [ ] **Step 2: Run the full test suite**

Run: `npm.cmd run test`

Expected: PASS, including the existing editor and list navigation tests.

- [ ] **Step 3: Build the production app**

Run: `npm.cmd run build`

Expected: PASS and emit both document editor routes.

- [ ] **Step 4: Commit**

```powershell
git add src/components/DocumentEditor.tsx src/components/DocList.tsx
git commit -m "fix: await PDF font loading in document actions"
```
