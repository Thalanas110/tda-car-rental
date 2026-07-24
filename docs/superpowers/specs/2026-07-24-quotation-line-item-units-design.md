# Quotation Line-Item Units Design

## Purpose

Allow each quotation trip to name its own vehicle unit, while making repeated
passengers and units fast to enter and visually clear in the generated PDF.

## Editor behavior

Quotation documents remove the document-level `Unit Requested` field. Their
line-item table gains a `Unit` field for every row. Billing continues to use
its existing document-level `Unit Used` field and has no new line-item Unit
field.

Place `Same passenger?` and `Same unit?` checkboxes beside the quotation
line-item controls. When checked, the first line item's corresponding value
is copied to all later rows and remains synchronized as the first value
changes. New rows receive that value automatically. Later-row inputs for the
synchronized field are disabled so the visible state cannot diverge from the
PDF. Unchecking retains the copied values and makes every row independently
editable again.

The checkbox state is derived when editing an existing quotation: it is on
when all line items have the same non-empty corresponding value, otherwise it
is off. Empty line-item collections leave both checkboxes off. No checkbox
flags are stored separately.

## Persistence and compatibility

Add `unit` to the line-item JSON structure. Existing saved quotation rows
without an item-level Unit use the document-level legacy `unit` value when
opened for editing or rendered directly from the document list, assigning it
to every effective line item. Saving writes the item-level Units normally.

The existing document-level `unit` database column remains for compatibility
and list display. For a newly saved quotation it stores the shared item Unit
when every line item has the same non-empty Unit, `Multiple units` when they differ,
and
an empty value when there are no line items or every Unit is blank. The generated quotation PDF reads
Units from line items, falling back to the legacy document value only when an
old item has no Unit property.

## PDF layout

Quotation PDFs retain five line-item columns with equal 80pt left and right
margins on Letter pages. Their fixed widths total the resulting 452pt table
space:

| Column | Width (pt) |
| --- | ---: |
| Date | 70 |
| Unit | 75 |
| Destination | 140 |
| Passenger | 85 |
| Amount | 82 |

Destination is the widest column. Each column retains its width across every
table row and page. When all item Units or all item Passengers are identical,
the PDF removes internal horizontal borders in that column and renders the
shared non-empty value once. Date, Destination, and Amount always remain
per-row.

## Testing

Cover quotation editor creation and editing with per-row Units; checkbox
synchronization, later-row disabling, and new-row defaults; compatibility for
legacy quotations; quotation persistence summary values; and PDF fixed-width
layout, equal margins, and conditional Unit/Passenger column merging. Retain
coverage that billing remains unchanged.
