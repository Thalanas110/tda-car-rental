# PDF Signing Editor Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real resize controls to the Contracts PDF editor, make fill behavior reliable after overlays exist, and fix desktop download/export.

**Architecture:** Keep overlay geometry in PDF coordinates, extend `OverlayCanvas` with explicit move/resize interaction state, and route final export through the Electron desktop bridge instead of a browser anchor click.

**Tech Stack:** React, Electron preload bridge, pdf-lib, pdfjs-dist, Vitest, Testing Library

## Global Constraints

- TDD required: write failing tests first, then implement the minimal fix, then verify.
- Signature overlays must preserve aspect ratio while resizing.
- Text overlays must resize freely.
- Use the existing Electron bridge patterns rather than adding a parallel save path.
- Keep the existing Contracts route and toolbar structure intact unless a bug fix requires a focused adjustment.

---

### Task 1: Lock current bugs with failing tests

**Files:**
- Modify: `tests/component/pdf/OverlayCanvas.test.tsx`
- Modify: `tests/component/contract-editor/ContractEditor.test.tsx`

**Interfaces:**
- Consumes: current `OverlayCanvas` and `ContractEditor`
- Produces: failing tests for resize, multi-item fill behavior, and desktop-aware download

- [ ] Add a failing test for resizing a text overlay and expecting width/height changes.
- [ ] Add a failing test for resizing a signature overlay and expecting aspect-ratio-safe dimensions.
- [ ] Add a failing test that places/fills text after an overlay already exists.
- [ ] Add a failing test that expects contract download to use the desktop save path instead of only clicking a browser anchor.
- [ ] Run only the new tests and confirm they fail for the expected reasons.

### Task 2: Implement overlay resize interactions

**Files:**
- Modify: `src/components/pdf/OverlayCanvas.tsx`
- Modify: `src/lib/contract-pdf.types.ts` if richer interaction metadata is needed

**Interfaces:**
- Consumes: overlay geometry in PDF points
- Produces: selected-item resize handles and updated `onUpdate(id, patch)` geometry writes

- [ ] Add explicit interaction state for move vs resize.
- [ ] Add visible resize handles to selected overlays.
- [ ] Implement free resize for text items with minimum width/height guards.
- [ ] Implement proportional resize for signature items with aspect-ratio preservation.
- [ ] Re-run the focused overlay tests and confirm they pass.

### Task 3: Fix fill behavior on top of the new interaction model

**Files:**
- Modify: `src/components/ContractEditor.tsx`
- Modify: `src/components/pdf/OverlayCanvas.tsx`

**Interfaces:**
- Consumes: `handlePageClick`, overlay selection/update callbacks
- Produces: reliable placement, selection, editing, dragging, and resizing for text items

- [ ] Ensure empty-surface clicks still route to placement while add mode is active.
- [ ] Ensure overlay body/handle interactions stop propagation so they do not place duplicate items.
- [ ] Ensure text editing still commits content updates after move/resize support is added.
- [ ] Run the focused contract-editor tests and confirm fill behavior passes.

### Task 4: Fix desktop-aware contract download

**Files:**
- Modify: `src/components/ContractEditor.tsx`
- Modify: Electron bridge files as needed
- Modify: `src/lib/electron-api.ts` if the contract export call needs a typed wrapper

**Interfaces:**
- Consumes: `exportContractPdf()` output bytes
- Produces: a desktop save flow that writes the generated PDF through Electron

- [ ] Inspect the existing document save bridge and reuse that pattern for contract PDF export.
- [ ] Add or extend preload/main IPC for saving generated contract PDFs.
- [ ] Update `ContractEditor` download to call the desktop save path and surface toast errors on failure.
- [ ] Re-run the targeted download/export tests and confirm they pass.

### Task 5: Final verification

**Files:**
- Verify the modified editor, overlay, and bridge files

**Interfaces:**
- Consumes: all previous tasks
- Produces: verified working editor behavior

- [ ] Run `npm test -- tests/component/pdf/OverlayCanvas.test.tsx tests/component/contract-editor/ContractEditor.test.tsx`
- [ ] Run `npm run build`
- [ ] If either command fails, fix the root cause and re-run before claiming completion.
