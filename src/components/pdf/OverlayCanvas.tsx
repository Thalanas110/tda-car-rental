import { useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import type { OverlayItem } from "@/lib/contract-pdf.types";
import { pdfToCanvas } from "@/lib/contract-pdf-coordinate";

type OverlayCanvasProps = {
  items: OverlayItem[];
  currentPage: number;
  canvasWidth: number;
  canvasHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  onUpdate: (id: string, patch: Partial<OverlayItem>) => void;
  onDelete: (id: string) => void;
  onSurfaceClick: (info: {
    x: number;
    y: number;
    pageNumber: number;
    viewportWidth: number;
    viewportHeight: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => void;
  signatureDataUrl?: string;
};

export function OverlayCanvas({
  items,
  currentPage,
  canvasWidth,
  canvasHeight,
  viewportWidth,
  viewportHeight,
  onUpdate,
  onDelete,
  onSurfaceClick,
  signatureDataUrl,
}: OverlayCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    id: string;
    startX: number;
    startY: number;
    itemX: number;
    itemY: number;
  } | null>(null);

  const viewport = { width: viewportWidth, height: viewportHeight };
  const pageItems = items.filter((item) => item.pageNumber === currentPage);

  const toCanvasCoords = (pdfX: number, pdfY: number) =>
    pdfToCanvas(pdfX, pdfY, viewport, canvasWidth, canvasHeight);

  const handlePointerDown = (e: ReactPointerEvent, item: OverlayItem) => {
    e.stopPropagation();
    setSelectedId(item.id);
    setDragState({
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      itemX: item.x,
      itemY: item.y,
    });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!dragState) return;
    const dx = (e.clientX - dragState.startX) * (viewportWidth / canvasWidth);
    const dy = (e.clientY - dragState.startY) * (viewportHeight / canvasHeight);
    onUpdate(dragState.id, {
      x: dragState.itemX + dx,
      y: dragState.itemY + dy,
    });
  };

  const handlePointerUp = () => {
    setDragState(null);
  };

  const handleSurfaceClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    setSelectedId(null);
    if (e.target !== e.currentTarget) return;

    const rect = e.currentTarget.getBoundingClientRect();
    onSurfaceClick({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pageNumber: currentPage,
      viewportWidth,
      viewportHeight,
      canvasWidth,
      canvasHeight,
    });
  };

  return (
    <div
      className="absolute inset-0"
      style={{ width: canvasWidth, height: canvasHeight }}
      onClick={handleSurfaceClick}
    >
      {pageItems.map((item) => {
        const pos = toCanvasCoords(item.x, item.y);
        const isSelected = item.id === selectedId;

        return (
          <div
            key={item.id}
            className={`absolute border ${isSelected ? "border-blue-500" : "border-transparent"} ${
              item.type === "text" ? "bg-white/80 cursor-move" : ""
            }`}
            style={{
              left: pos.x,
              top: pos.y,
              width: (item.width / viewportWidth) * canvasWidth,
              height: (item.height / viewportHeight) * canvasHeight,
            }}
            onPointerDown={(e) => handlePointerDown(e, item)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {item.type === "text" ? (
              <div
                contentEditable={isSelected}
                suppressContentEditableWarning
                className="w-full h-full p-1 text-black outline-none"
                style={{ fontSize: item.fontSize ?? 12 }}
                onBlur={(e) => onUpdate(item.id, { content: e.currentTarget.textContent ?? "" })}
              >
                {item.content}
              </div>
            ) : (
              <img
                src={signatureDataUrl}
                alt="Signature"
                className="w-full h-full object-contain pointer-events-none"
              />
            )}
            {isSelected && (
              <button
                aria-label="Delete"
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
