# Excel-like Merged Cells in Quotation PDFs

## Purpose

Quotation tables already identify a shared Unit or Passenger value when all
line items use that value. The PDF must render those fields as one visual cell,
matching the familiar appearance of a vertically merged Excel cell.

## Decision

Keep the existing data and same-value editor controls unchanged. In quotation
PDFs only, when every line item has the same non-empty Unit or Passenger:

- Draw one outer cell border for that field across the shared consecutive rows.
- Suppress its internal horizontal borders.
- Draw the shared value once, horizontally and vertically centered in the
  resulting cell.
- Leave Date, Destination, and Amount as independent row cells.

jsPDF AutoTable paginates rows independently, so a shared group that crosses a
page boundary is split into one visual merged segment per page. Each segment
has its own outer border and centered value; no content is drawn across a page
boundary.

## Rendering approach

AutoTable continues to calculate the table layout and row heights. Its text in
shared Unit and Passenger cells is suppressed. After a relevant cell is drawn,
the renderer groups adjacent shared rows on the same page, paints the group
border and white interior over AutoTable's individual cells, then writes the
wrapped value at the calculated midpoint. The hidden source cell reserves the
same wrapped height before AutoTable lays out the row, so multi-line values
remain inside the merged border. The normal black drawing state is restored
afterward.

This avoids changing persisted data or relying on unsupported AutoTable row-
span behavior.

## Verification

PDF tests will assert that shared cells have no row-level text, have a single
custom centered text draw at the midpoint of their group, and retain their
outer geometry. Tests will also cover independent per-page segments for a
group spanning a page break where practical through AutoTable's recorded rows.
