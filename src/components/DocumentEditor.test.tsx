import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ saveDoc: vi.fn(), updateDoc: vi.fn() }));
const pdf = vi.hoisted(() => ({ generatePdf: vi.fn() }));

vi.mock("@/lib/db", () => ({ ...db }));
vi.mock("@/lib/pdf", () => ({ ...pdf }));

import { DocumentEditor } from "./DocumentEditor";

describe("DocumentEditor", () => {
  beforeEach(() => {
    db.saveDoc.mockReset().mockResolvedValue(8);
    db.updateDoc.mockReset().mockResolvedValue(undefined);
    pdf.generatePdf.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("updates the current document instead of inserting another record", async () => {
    render(
      <DocumentEditor
        docType="billing"
        documentId={7}
        initial={{
          date: "14 June 2026",
          billedTo: "Path Foundation",
          unit: "Sedan",
          driver: "Teddy Dimate",
          items: [],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(db.updateDoc).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          doc_type: "billing",
          doc_date: "14 June 2026",
          billed_to: "Path Foundation",
        }),
      );
    });
    expect(db.saveDoc).not.toHaveBeenCalled();
  });

  it("opens a preview tab before asynchronous PDF generation completes", async () => {
    let resolvePdf: (value: { output: (type: string) => string }) => void;
    pdf.generatePdf.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePdf = resolve;
      }),
    );
    const previewWindow = { location: { href: "" } } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(previewWindow);

    render(<DocumentEditor docType="billing" />);

    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));

    expect(open).toHaveBeenCalledWith("", "_blank");
    resolvePdf!({ output: () => "blob:preview" });
    await waitFor(() => {
      expect(previewWindow.location.href).toBe("blob:preview");
    });
  });
});
