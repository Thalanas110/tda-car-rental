import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePdf } from "./pdf";

const input = {
  docType: "billing" as const,
  date: "14 June 2026",
  billedTo: "Path Foundation",
  unit: "Sedan",
  driver: "Teddy Dimate",
  items: [],
};
const signatureName = (() => {
  try {
    return readdirSync("signature").find((name) => /\.(jpe?g|png)$/i.test(name));
  } catch {
    return undefined;
  }
})();
const signatureTest = signatureName ? it : it.skip;
const noSignatureTest = signatureName ? it.skip : it;

type TableCell = {
  text: string[];
  x: number;
  y: number;
  width: number;
};
type GeneratedTable = {
  head: Array<{ cells: Record<number, TableCell> }>;
  body: Array<{ cells: Record<number, TableCell> }>;
};

function generatedTable(pdf: Awaited<ReturnType<typeof generatePdf>>): GeneratedTable {
  return (pdf as unknown as { lastAutoTable: GeneratedTable }).lastAutoTable;
}

function textPosition(output: string, text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(new RegExp(`([\\d.]+) ([\\d.]+) Td\\n\\(${escaped}\\) Tj`));
  expect(match).not.toBeNull();
  return { x: Number(match![1]), y: Number(match![2]) };
}

describe("generatePdf", () => {
  beforeEach(async () => {
    const britannicBold = await readFile("public/Britannic Bold Regular.ttf");
    const signature = signatureName ? await readFile(`signature/${signatureName}`) : undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/Britannic%20Bold%20Regular.ttf") {
          return Promise.resolve(new Response(britannicBold));
        }
        return Promise.resolve(new Response(signature, { status: signature ? 200 : 404 }));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers Britannic Bold for the generated document header", async () => {
    const pdf = await generatePdf(input);

    expect(fetch).toHaveBeenCalledWith("/Britannic%20Bold%20Regular.ttf");
    expect(pdf.getFontList()["Britannic Bold"]).toContain("normal");
  });

  it("leaves the footer in a bold non-italic Times face", async () => {
    const pdf = await generatePdf(input);

    expect(pdf.internal.getFont()).toMatchObject({
      fontName: "times",
      fontStyle: "bold",
    });
  });

  signatureTest("embeds the local signature beside billing payment details", async () => {
    const pdf = await generatePdf(input);

    expect(pdf.output()).toContain("/Subtype /Image");
  });

  noSignatureTest("generates billing PDFs without a local signature", async () => {
    const pdf = await generatePdf(input);

    expect(pdf.output()).not.toContain("/Subtype /Image");
  });

  it("does not embed the signature in quotation PDFs", async () => {
    const pdf = await generatePdf({ ...input, docType: "quotation" });

    expect(pdf.output()).not.toContain("/Subtype /Image");
  });

  it("renders a quotation requestor above a merged unit column", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      requestor: "Path Foundation",
      unit: "Toyota HiAce",
      items: [
        { date: "2026-06-11", destination: "Subic", passenger: "2", amount: 1200 },
        { date: "2026-06-12", destination: "Olongapo", passenger: "3", amount: 900 },
      ],
    });

    const output = pdf.output();
    const heading = textPosition(output, "QUOTATION REQUEST");
    const requestor = textPosition(output, "Requestor: Path Foundation");
    const unit = textPosition(output, "UNIT");
    const table = generatedTable(pdf);
    const unitHeader = table.head[0].cells[4];
    const firstUnitCell = table.body[0].cells[4];
    const secondUnitCell = table.body[1].cells[4];

    expect(requestor).toEqual({ x: heading.x, y: heading.y - 13 });
    expect(unitHeader.text).toEqual(["UNIT"]);
    expect(unitHeader.x).toBeGreaterThan(table.head[0].cells[3].x);
    expect(unit.x).toBeGreaterThan(heading.x);
    expect(firstUnitCell.text).toEqual(["Toyota HiAce"]);
    expect(secondUnitCell.text).toEqual([""]);
    expect(secondUnitCell.x).toBe(firstUnitCell.x);
    expect(secondUnitCell.width).toBe(firstUnitCell.width);
    const pageHeight = pdf.internal.pageSize.getHeight();
    const borderY = pageHeight - secondUnitCell.y;
    expect(output).toMatch(
      new RegExp(
        `1\\. G\\n1\\. w\\n${secondUnitCell.x + 0.5} ${borderY}\\.? m\\n${secondUnitCell.x + secondUnitCell.width - 0.5} ${borderY}\\.? l\\nS`,
      ),
    );
    expect(output).not.toContain("(Requestor) Tj");
    expect(output).not.toContain("Unit Requested:");
  });

  it("keeps the requestor label and an empty unit body when a quotation has no line items", async () => {
    const pdf = await generatePdf({ ...input, docType: "quotation", requestor: "", items: [] });

    expect(pdf.output()).toContain("(Requestor: ) Tj");
    expect(generatedTable(pdf).head[0].cells[4].text).toEqual(["UNIT"]);
    expect(generatedTable(pdf).body).toHaveLength(0);
  });

  it("moves billing totals and payment details to a new page before the footer", async () => {
    const pdf = await generatePdf({
      ...input,
      items: Array.from({ length: 12 }, (_, index) => ({
        date: `2026-06-${index + 1}`,
        destination: "Olongapo City",
        passenger: "1",
        amount: 100,
      })),
    });

    expect(pdf.getNumberOfPages()).toBe(2);
  });
});
