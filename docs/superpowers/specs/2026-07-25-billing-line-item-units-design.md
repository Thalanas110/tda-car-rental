# Billing Line-Item Units Design

## Purpose

Billing documents will use the same per-line-item Unit model as quotations.
This allows one billing document to accurately represent trips using different
vehicles while preserving the fast entry path for repeated values.

## Editor behavior

- Remove the billing-only document field labelled `Unit Used`.
- Add a Unit column to every billing line item, placed between Date and
  Destination.
- Show `Same passenger?` and `Same unit?` controls beside Billing Line Items.
  Enabling a control copies the first row value into all later rows; changing
  the first row while enabled keeps later rows synchronized; new rows inherit
  enabled shared values.
- Keep billing's existing Date, Billed To, and Driver fields. Billing never
  renders or stores a Requestor value.

## Data compatibility

`Item.unit` remains the source of truth for newly saved billing and quotation
rows. For an older billing record whose line items lack `unit`, copy the saved
document-level `unit` value into each row when opening the editor or rendering
the PDF directly from the list. The document-level `unit` column remains a
compatibility summary: empty for no rows or all blank Units, the shared Unit
when every non-empty Unit matches, and `Multiple units` otherwise.

## Billing PDF behavior

Billing PDFs change their line-item columns to Date, Unit, Destination,
Passenger, and Amount. They reuse quotation's fixed 80pt left/right margins,
70/75/140/85/82 column widths, conditional Unit/Passenger merge drawing,
wrapping, row-height reservation, and one independent merged segment per PDF
page. Date, Destination, and Amount remain row-level.

The billing heading retains Billed To, DETAILS: CAR RENTAL SERVICES, and
Driver. The former `Unit Used:` line is removed. Requestor is quotation-only.

## Verification

Tests cover billing editor synchronization, row Unit persistence and summary
values, legacy Unit fallback, absence of Requestor and Unit Used in billing,
fixed PDF geometry, true centered merged fields, wrapped long values, and
multi-page groups. Existing quotation behavior remains unchanged.
