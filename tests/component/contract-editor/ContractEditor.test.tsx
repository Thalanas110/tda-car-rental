import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist", () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 612, height: 792, scale: 1 }),
        render: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
  GlobalWorkerOptions: { workerSrc: "" },
}));

vi.mock("@/lib/contract-pdf", () => ({
  exportContractPdf: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

import { ContractEditor } from "@/components/ContractEditor";
import { exportContractPdf } from "@/lib/contract-pdf";

describe("ContractEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows upload area initially", () => {
    render(<ContractEditor />);
    expect(screen.getByText(/drop a pdf/i)).toBeInTheDocument();
  });

  it("shows toolbar after PDF is loaded", async () => {
    render(<ContractEditor />);

    const file = new File(["dummy"], "contract.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText(/upload/i);
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/add text/i)).toBeInTheDocument();
    });
  });

  it("calls exportContractPdf when download is clicked", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(""));

    render(<ContractEditor />);

    const file = new File(["dummy"], "contract.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText(/upload/i);
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/download/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/download/i));

    await waitFor(() => {
      expect(exportContractPdf).toHaveBeenCalled();
    });
  });
});
