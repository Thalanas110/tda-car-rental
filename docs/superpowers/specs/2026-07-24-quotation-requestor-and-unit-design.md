# Quotation Requestor and Unit Layout

## Purpose

Make quotation PDFs show the requestor as document metadata rather than as a
line-item-table column, and use that table space for the requested vehicle
unit.

## PDF layout

For quotation documents, the header detail block will be ordered as follows:

1. `QUOTATION REQUEST`
2. `Requestor: <requestor>`

The quotation line-item table will retain five columns, with its final column
changed from `Requestor` to `UNIT`. The unit value supplied in the existing
quotation editor will appear once in that column and visually span all table
body rows, matching the current merged-column treatment used by Requestor.

Billing PDFs are unchanged.

## Data and editor behavior

No database schema, API, or editor changes are needed. Quotations continue to
store `requestor` and `unit` in their existing fields. The existing `Unit
Requested` input remains the source of the quotation table's `UNIT` value.

## Edge cases

When a quotation has no requestor, the PDF still shows `Requestor:` with an
empty value. When it has no line items, the existing table behavior is
preserved; no new fallback row is introduced.

## Testing

Update PDF tests to verify that quotation output includes the header requestor
line, uses `UNIT` as the rightmost table header, puts the unit in that merged
column, and does not render Requestor as a table header. Retain billing PDF
coverage to ensure the change does not affect billing output.
