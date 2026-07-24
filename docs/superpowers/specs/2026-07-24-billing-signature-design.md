# Billing PDF signature

## Scope

Add a locally supplied signature image to billing PDFs only. The root `signature/` directory stays untracked. Quotation PDFs remain unsigned.

## Placement

The signature appears in the right column directly below the numeric total amount, aligned beside the billing payment-details lines. It does not sit below the `TOTAL AMOUNT DUE:` label or displace the payment-details block.

## Implementation

Use Vite's eager asset glob to discover the first JPG, JPEG, or PNG in `signature/` without hard-coding its filename. Fetch the discovered asset, cache the image data, and add it to billing PDFs at a fixed right-column position. If no image is present, omit the signature and generate the document normally. Add `signature/` to `.gitignore`.

## Verification

Add coverage confirming a billing PDF fetches and places the signature, while a quotation PDF does neither. Run the full test suite and production build.
