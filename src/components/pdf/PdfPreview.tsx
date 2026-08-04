import { useEffect, useRef, useState, type MouseEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { ChevronLeft, ChevronRight } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type PageClickInfo = {
  x: number;
  y: number;
  pageNumber: number;
  viewportWidth: number;
  viewportHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};

type PdfPreviewProps = {
  pdfBytes: Uint8Array;
  onPageClick: (info: PageClickInfo) => void;
};

export function PdfPreview({ pdfBytes, onPageClick }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pdfRef = useRef<Awaited<ReturnType<typeof pdfjsLib.getDocument>> | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      if (cancelled) return;
      pdfRef.current = doc;
      setTotalPages(doc.numPages);
      setCurrentPage(0);
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [pdfBytes]);

  useEffect(() => {
    let cancelled = false;
    const renderPage = async () => {
      const doc = pdfRef.current;
      const canvas = canvasRef.current;
      if (!doc || !canvas) return;

      const page = await doc.getPage(currentPage + 1);
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const maxWidth = canvas.parentElement?.clientWidth ?? 600;
      const scale = maxWidth / baseViewport.width;
      const vp = page.getViewport({ scale });

      canvas.width = vp.width;
      canvas.height = vp.height;
      setViewport({ width: baseViewport.width, height: baseViewport.height });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    };
    renderPage();
    return () => { cancelled = true; };
  }, [currentPage, totalPages]);

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport) return;
    const rect = canvas.getBoundingClientRect();
    onPageClick({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pageNumber: currentPage,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          aria-label="Previous page"
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
          className="btn-secondary disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm">
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          aria-label="Next page"
          onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={currentPage >= totalPages - 1}
          className="btn-secondary disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        onClick={handleClick}
        className="border cursor-crosshair"
      />
    </div>
  );
}
