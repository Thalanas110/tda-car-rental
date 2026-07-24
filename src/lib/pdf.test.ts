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

describe("generatePdf", () => {
  beforeEach(async () => {
    const britannicBold = await readFile("public/Britannic Bold Regular.ttf");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(britannicBold)));
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
});
