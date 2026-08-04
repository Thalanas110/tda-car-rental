import { useCallback, useState } from "react";
import { Download, Type, Pen } from "lucide-react";
import { PdfPreview } from "@/components/pdf/PdfPreview";
import { OverlayCanvas } from "@/components/pdf/OverlayCanvas";
import { exportContractPdf } from "@/lib/contract-pdf";
import { canvasToPdf } from "@/lib/contract-pdf-coordinate";
import type { OverlayItem } from "@/lib/contract-pdf.types";

const signatureAssets = import.meta.glob("../../signature/*.{png,PNG}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;
const signatureUrl = Object.values(signatureAssets)[0];

export function ContractEditor() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [mode, setMode] = useState<"select" | "text" | "signature">("select");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<{
    viewportWidth: number;
    viewportHeight: number;
    canvasWidth: number;
    canvasHeight: number;
  } | null>(null);
  const [fontSize, setFontSize] = useState(12);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    setPdfBytes(bytes);
    setOverlays([]);
    setCurrentPage(0);
  }, []);

  const handlePageClick = useCallback(
    (info: {
      x: number;
      y: number;
      pageNumber: number;
      viewportWidth: number;
      viewportHeight: number;
      canvasWidth: number;
      canvasHeight: number;
    }) => {
      setPageInfo({
        viewportWidth: info.viewportWidth,
        viewportHeight: info.viewportHeight,
        canvasWidth: info.canvasWidth,
        canvasHeight: info.canvasHeight,
      });

      const viewport = { width: info.viewportWidth, height: info.viewportHeight };
      const pdfCoords = canvasToPdf(info.x, info.y, viewport, info.canvasWidth, info.canvasHeight);

      if (mode === "text") {
        const newItem: OverlayItem = {
          id: crypto.randomUUID(),
          type: "text",
          pageNumber: info.pageNumber,
          x: pdfCoords.x,
          y: pdfCoords.y,
          width: 150,
          height: 20,
          content: "",
          fontSize,
        };
        setOverlays((prev) => [...prev, newItem]);
        setMode("select");
      } else if (mode === "signature") {
        const newItem: OverlayItem = {
          id: crypto.randomUUID(),
          type: "signature",
          pageNumber: info.pageNumber,
          x: pdfCoords.x,
          y: pdfCoords.y,
          width: 120,
          height: 80,
        };
        setOverlays((prev) => [...prev, newItem]);
        setMode("select");
      }
    },
    [mode, fontSize],
  );

  const handleUpdate = useCallback((id: string, patch: Partial<OverlayItem>) => {
    setOverlays((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleDownload = useCallback(async () => {
    if (!pdfBytes) return;
    const signatureDataUrl = signatureUrl
      ? await fetch(signatureUrl).then((r) => r.text())
      : undefined;
    const result = await exportContractPdf({ pdfBytes, overlays, signatureDataUrl });
    const blob = new Blob([result], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contract-signed.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }, [pdfBytes, overlays]);

  return (
    <div className="space-y-4">
      {!pdfBytes ? (
        <label className="block border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-accent">
          <input
            type="file"
            accept=".pdf"
            className="sr-only"
            aria-label="Upload PDF contract"
            onChange={handleFileChange}
          />
          <p className="text-muted-foreground">Drop a PDF or click to browse</p>
        </label>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("select")}
              className={`btn-secondary ${mode === "select" ? "bg-accent" : ""}`}
            >
              Select
            </button>
            <button
              onClick={() => setMode("text")}
              className={`btn-secondary ${mode === "text" ? "bg-accent" : ""}`}
            >
              <Type className="h-4 w-4 mr-1" /> Add Text
            </button>
            <button
              onClick={() => setMode("signature")}
              className={`btn-secondary ${mode === "signature" ? "bg-accent" : ""}`}
            >
              <Pen className="h-4 w-4 mr-1" /> Add Signature
            </button>
            <label className="flex items-center gap-1 text-sm ml-4">
              Size:
              <input
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                min={6}
                max={72}
                className="w-16 input"
              />
            </label>
            <button onClick={handleDownload} className="btn-primary ml-auto">
              <Download className="h-4 w-4 mr-1" /> Download
            </button>
          </div>

          <div className="relative inline-block">
            <PdfPreview pdfBytes={pdfBytes} onPageClick={handlePageClick} />
            {pageInfo && (
              <OverlayCanvas
                items={overlays}
                currentPage={currentPage}
                canvasWidth={pageInfo.canvasWidth}
                canvasHeight={pageInfo.canvasHeight}
                viewportWidth={pageInfo.viewportWidth}
                viewportHeight={pageInfo.viewportHeight}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                signatureDataUrl={signatureUrl}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
