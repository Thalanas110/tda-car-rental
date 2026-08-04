# PDF Signing Editor Polish Design

## Overview

Stabilize the Contracts PDF editor so it behaves like a real fill-and-sign tool inside the Electron desktop app. This pass adds direct resize controls for placed items, fixes inconsistent text-fill behavior after overlays exist, and replaces the fragile browser-style download flow with a desktop-aware export path.

## Approved Interaction Model

- Signature overlays resize with a locked aspect ratio.
- Text overlays resize freely in both directions.
- Both text and signature overlays remain draggable.
- Empty-space clicks on the PDF should continue to place new items while in add modes.
- Selected overlays should expose direct manipulation controls instead of requiring toolbar-only edits.

## Current Problems

1. Overlay items can be moved but not resized because the overlay layer has no resize state or resize handles.
2. Fill behavior becomes inconsistent after the first overlay is added because the overlay surface and item interaction model do not cleanly separate placement clicks from selection/manipulation clicks.
3. Download behaves like the previously broken save flow because it still relies on a web-style anchor click instead of a desktop-aware save/export path.

## Design

### Overlay Interaction Layer

`OverlayCanvas` will support three interaction modes per selected item:

- Move: pointer drag on the item body updates `x` and `y`
- Resize: pointer drag on a visible handle updates `width` and `height`
- Delete: existing delete affordance remains

Resize handles will appear only for the selected item. Text items will support free resizing. Signature items will enforce a fixed aspect ratio derived from the placed item dimensions.

### Placement and Fill Consistency

The PDF editor will keep one source of truth for overlay geometry in PDF coordinates. Empty-surface clicks will continue to create text/signature items through `ContractEditor.handlePageClick`, while overlay item interactions will stop propagation so selection, dragging, resizing, and inline editing do not accidentally trigger placement.

Text items will remain editable inline, but selection and resize will operate on the text box container rather than fighting with the editable content region.

### Desktop-Aware Download

Contract export will produce final PDF bytes the same way it does now, but download initiation will prefer the Electron bridge when available. The renderer will ask the desktop layer to write the generated file to disk via a save dialog. If the desktop bridge is unavailable, the UI should surface a clear toast error instead of silently doing nothing.

## Files In Scope

- `src/components/ContractEditor.tsx`
- `src/components/pdf/OverlayCanvas.tsx`
- `src/lib/contract-pdf.ts`
- `src/lib/contract-pdf.types.ts`
- `src/lib/electron-api.ts`
- Electron preload/main files if the file-save bridge needs expansion
- `tests/component/contract-editor/ContractEditor.test.tsx`
- `tests/component/pdf/OverlayCanvas.test.tsx`
- additional unit tests for export helpers if needed

## Error Handling

- Export failure should show a toast with an actionable message.
- Missing desktop bridge should produce an explicit desktop-app error, not a no-op.
- Resize should enforce minimum item sizes so text boxes and signatures remain usable.

## Testing

- Component tests for resizing text and signature overlays
- Component tests that verify fill behavior still works after one or more overlays exist
- Component/unit tests that verify download delegates to the desktop save flow
