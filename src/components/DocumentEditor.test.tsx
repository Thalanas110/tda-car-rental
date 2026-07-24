import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ saveDoc: vi.fn(), updateDoc: vi.fn() }));

vi.mock("@/lib/db", () => ({ ...db }));
vi.mock("@/lib/pdf", () => ({ generatePdf: vi.fn() }));

import { DocumentEditor } from "./DocumentEditor";

describe("DocumentEditor", () => {
  beforeEach(() => {
    db.saveDoc.mockReset().mockResolvedValue(8);
    db.updateDoc.mockReset().mockResolvedValue(undefined);
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
});
