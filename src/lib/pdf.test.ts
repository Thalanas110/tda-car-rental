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
