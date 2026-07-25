import { describe, expect, it } from "vitest";
import type { DocRow } from "./db";
import { toEditorInitial } from "./document-editor-data";

const row: DocRow = {
  id: 7,
  doc_type: "billing",
  doc_date: "14 June 2026",
  billed_to: "Path Foundation",
  unit: "Sedan",
  driver: "Teddy Dimate",
  requestor: "",
  total: 1200,
  items_json: '[{"date":"11-Jun-26","destination":"Makati","passenger":"A. Cruz","amount":1200}]',
  created_at: "2026-06-14 08:00:00",
};

describe("toEditorInitial", () => {
  it("converts a stored document into editor values", () => {
    expect(toEditorInitial(row)).toEqual({
      date: "14 June 2026",
      billedTo: "Path Foundation",
      unit: "Sedan",
      driver: "Teddy Dimate",
      requestor: "",
      items: [
        {
          date: "11-Jun-26",
          destination: "Makati",
          passenger: "A. Cruz",
          amount: 1200,
          unit: "Sedan",
        },
      ],
    });
  });

  it("copies a legacy quotation unit into every line item", () => {
    const quotation: DocRow = {
      ...row,
      doc_type: "quotation",
      unit: "Toyota HiAce",
      items_json: JSON.stringify([
        { date: "11-Jun-26", destination: "Makati", passenger: "A. Cruz", amount: 1200 },
        { date: "12-Jun-26", destination: "Subic", passenger: "A. Cruz", amount: 900 },
      ]),
    };

    expect(toEditorInitial(quotation)?.items).toEqual([
      { date: "11-Jun-26", destination: "Makati", passenger: "A. Cruz", amount: 1200, unit: "Toyota HiAce" },
      { date: "12-Jun-26", destination: "Subic", passenger: "A. Cruz", amount: 900, unit: "Toyota HiAce" },
    ]);
  });

  it("copies a legacy billing unit into every line item", () => {
    expect(toEditorInitial(row)?.items).toEqual([expect.objectContaining({ unit: "Sedan" })]);
  });

  it("returns null when stored line items are malformed", () => {
    expect(toEditorInitial({ ...row, items_json: "not-json" })).toBeNull();
  });

  it.each(["[null]", '[{"amount":"bad"}]'])(
    "returns null for invalid item arrays: %s",
    (itemsJson) => {
      expect(toEditorInitial({ ...row, items_json: itemsJson })).toBeNull();
    },
  );
});
