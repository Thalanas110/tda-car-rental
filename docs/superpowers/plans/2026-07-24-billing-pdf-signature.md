# Billing PDF Signature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ignored local signature image beside the billing payment details, directly below the numeric total amount.

**Architecture:** `src/lib/pdf.ts` will use Vite's eager `import.meta.glob` to discover the first image in the root `signature/` directory. The generator will fetch and cache that asset only for billing documents, then add it to the right column after the numeric total is drawn. The signature directory remains absent from source control.

**Tech Stack:** TypeScript, Vite asset imports, jsPDF, Vitest.

## Global Constraints

- Add the signature to billing PDFs only; never to quotations.
- Place it below the numeric amount, alongside payment details, not under the total label.
- Discover the first JPG, JPEG, or PNG from the ignored root `signature/` directory.
- Omit the signature without failing PDF generation when no asset is available.
- Do not commit the signature image.

---

### Task 1: Cover and render the billing signature

**Files:**
- Modify: `.gitignore`
- Modify: `src/lib/pdf.ts`
- Modify: `src/lib/pdf.test.ts`

**Interfaces:**
- Consumes: `generatePdf(input: PdfInput): Promise<jsPDF>` and one optional asset discovered by `import.meta.glob("../../signature/*.{jpg,jpeg,png,JPG,JPEG,PNG}")`.
- Produces: billing PDF output containing one embedded image resource and quotation PDF output with no signature image resource.

- [ ] **Step 1: Write the failing tests**

In `src/lib/pdf.test.ts`, load the actual ignored signature file alongside the bundled Britannic font and return the correct bytes from the mocked `fetch`. Add these tests:

```ts
it("embeds the local signature beside billing payment details", async () => {
  const pdf = await generatePdf(input);

  expect(pdf.output()).toContain("/Subtype /Image");
});

it("does not embed the signature in quotation PDFs", async () => {
  const pdf = await generatePdf({ ...input, docType: "quotation" });

  expect(pdf.output()).not.toContain("/Subtype /Image");
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm.cmd run test -- src/lib/pdf.test.ts`

Expected: the billing assertion fails because the generated PDF has no image resource.

- [ ] **Step 3: Add ignored, optional signature loading**

Append `signature/` to `.gitignore`. In `src/lib/pdf.ts`, discover supported image assets with an eager Vite glob. Sort the glob entries so the chosen first file is deterministic. Derive `"PNG"` or `"JPEG"` from the source path. Cache the fetched image as a `data:image/...;base64,...` URL. Return `undefined` without throwing when no glob entry exists or the fetch response is not OK.

```ts
const signatureAssets = import.meta.glob("../../signature/*.{jpg,jpeg,png,JPG,JPEG,PNG}", {
  eager: true,
  import: "default",
  query: "?url",
});
```

- [ ] **Step 4: Draw the billing-only image**

After drawing `money(total)` at `marginL + 220`, load the optional signature only for billing. Keep the payment-details text at `marginL`; add the image at `marginL + 220`, starting a few points below the total baseline and sized to occupy the right column beside the five payment-detail lines. Do not add any image in the quotation branch.

- [ ] **Step 5: Run focused tests to verify they pass**

Run: `npm.cmd run test -- src/lib/pdf.test.ts`

Expected: PASS with the billing document containing an image resource and the quotation document containing none.

- [ ] **Step 6: Run full verification and commit**

Run:

```powershell
npm.cmd run test
npm.cmd run build
```

Expected: all tests pass and the production build succeeds.

```powershell
git add .gitignore src/lib/pdf.ts src/lib/pdf.test.ts docs/superpowers/plans/2026-07-24-billing-pdf-signature.md
git commit -m "feat: add signature to billing PDFs"
```
