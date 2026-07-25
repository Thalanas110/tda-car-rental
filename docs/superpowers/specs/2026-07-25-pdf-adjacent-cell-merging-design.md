# PDF Adjacent Unit and Passenger Cell Merging

## Goal

In generated Billing and Quotation PDFs, merge only adjacent non-empty rows that
share an identical Unit or Passenger value.

## Scope

- Applies only to PDF rendering in `src/lib/pdf.ts`.
- Applies independently to the Unit and Passenger table columns.
- Does not change editor inputs, stored items, or the Same Unit / Same Passenger
  controls.

## Behaviour

For each column, scan the document's rows in order and divide them into runs.

- A run contains two or more consecutive rows whose stored strings are exactly
  equal and whose value is non-empty after trimming whitespace.
- Each qualifying run is rendered as one vertically merged, center-aligned cell.
- A value that occurs again after a different row is a distinct run and is not
  merged with the earlier occurrence.
- Empty values are never part of a run and remain individual blank cells.
- Unit and Passenger runs are determined separately, so their boundaries may
  differ.
- Existing page-local handling remains: a run that crosses a page boundary is
  rendered as a centered span for its visible portion on each page.

## Examples

| Row | Unit | Passenger | Unit result | Passenger result |
| --- | --- | --- | --- | --- |
| 1 | Toyota HiAce | A. Cruz | merges rows 1-2 | merges rows 1-3 |
| 2 | Toyota HiAce | A. Cruz | merges rows 1-2 | merges rows 1-3 |
| 3 | Van | A. Cruz | standalone | merges rows 1-3 |
| 4 | Toyota HiAce |  | standalone | standalone blank |

## Verification

PDF regression tests will cover adjacent matching values, non-adjacent repeats,
blank values, and independently bounded Unit and Passenger runs for Billing and
Quotation output.
