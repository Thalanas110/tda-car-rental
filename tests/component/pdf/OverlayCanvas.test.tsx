import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OverlayCanvas } from "@/components/pdf/OverlayCanvas";
import type { OverlayItem } from "@/lib/contract-pdf.types";

describe("OverlayCanvas", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders text overlay items", () => {
    const items: OverlayItem[] = [
      {
        id: "1",
        type: "text",
        pageNumber: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: "Hello",
        fontSize: 12,
      },
    ];

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders signature overlay items", () => {
    const items: OverlayItem[] = [
      {
        id: "sig-1",
        type: "signature",
        pageNumber: 0,
        x: 300,
        y: 400,
        width: 120,
        height: 80,
      },
    ];

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        signatureDataUrl="data:image/png;base64,abc"
      />,
    );

    expect(screen.getByRole("img", { name: /signature/i })).toBeInTheDocument();
  });

  it("only shows items for the current page", () => {
    const items: OverlayItem[] = [
      { id: "1", type: "text", pageNumber: 0, x: 0, y: 0, width: 100, height: 20, content: "Page 0" },
      { id: "2", type: "text", pageNumber: 1, x: 0, y: 0, width: 100, height: 20, content: "Page 1" },
    ];

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Page 0")).toBeInTheDocument();
    expect(screen.queryByText("Page 1")).not.toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", () => {
    const items: OverlayItem[] = [
      { id: "1", type: "text", pageNumber: 0, x: 0, y: 0, width: 100, height: 20, content: "Delete me" },
    ];
    const onDelete = vi.fn();

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );

    // Click the item container to select it (via pointerDown)
    const itemContainer = screen.getByText("Delete me").parentElement!;
    fireEvent.pointerDown(itemContainer, { clientX: 0, clientY: 0 });

    // Click delete button
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
