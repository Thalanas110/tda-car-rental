import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getDocument = vi.fn();

vi.mock("pdfjs-dist", () => ({
  getDocument: (...args: unknown[]) => getDocument(...args),
  GlobalWorkerOptions: { workerSrc: "" },
}));

import { PdfPreview } from "@/components/pdf/PdfPreview";

function createMockPage() {
  const viewport = vi.fn().mockReturnValue({ width: 612, height: 792, scale: 1 });
  return {
    getViewport: viewport,
    render: vi.fn().mockResolvedValue(undefined),
  };
}

const mockCtx = {
  canvas: null as unknown as HTMLCanvasElement,
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn().mockReturnValue({ data: new Uint8Array() }),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 0 }),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  createPattern: vi.fn(),
} as unknown as CanvasRenderingContext2D;

describe("PdfPreview", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a canvas element after loading the PDF", async () => {
    const mockPage = createMockPage();
    const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
    });
  });

  it("calls onPageClick with canvas coordinates when clicked", async () => {
    const mockPage = createMockPage();
    const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });
    const onPageClick = vi.fn();

    // Mock getContext before render
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={onPageClick} />);

    // Wait for canvas to be rendered with dimensions (indicates useEffect ran)
    await waitFor(() => {
      const canvas = screen.getByRole("img", { hidden: true });
      expect(canvas).toHaveAttribute("width", "612");
    });

    // Small delay for state to settle
    await new Promise((r) => setTimeout(r, 50));

    const canvas = screen.getByRole("img", { hidden: true });
    fireEvent.click(canvas, { clientX: 100, clientY: 200 });

    expect(onPageClick).toHaveBeenCalledWith(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
      pageNumber: 0,
    }));

    HTMLCanvasElement.prototype.getContext = origGetContext;
  });

  it("navigates between pages", async () => {
    const mockPage = createMockPage();
    const mockPdf = {
      numPages: 2,
      getPage: vi.fn().mockResolvedValue(mockPage),
    };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(mockPdf.getPage).toHaveBeenCalledWith(1);
    });
  });
});
