// PDF generation matching the reference layout (TDA Car Rental Services).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Item } from "./db";

const signatureAssets = import.meta.glob("../../signature/*.{jpg,jpeg,png,JPG,JPEG,PNG}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;
const [signaturePath, signatureUrl] = Object.entries(signatureAssets).sort(([left], [right]) =>
  left.localeCompare(right),
)[0] ?? [];

export interface PdfInput {
  docType: "billing" | "quotation";
  date: string; // e.g. "14 June 2026"
  billedTo?: string;
  unit: string;
  driver?: string;
  requestor?: string;
  items: Item[];
}

let britannicBoldBase64: Promise<string> | undefined;
let billingSignature: Promise<{ data: string; format: "JPEG" | "PNG" } | undefined> | undefined;

function arrayBufferToBase64(data: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(data)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function loadBritannicBold(): Promise<string> {
  britannicBoldBase64 ??= fetch("/Britannic%20Bold%20Regular.ttf")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Could not load Britannic Bold for PDF generation.");
      }
      return response.arrayBuffer();
    })
    .then(arrayBufferToBase64);
  return britannicBoldBase64;
}

function loadBillingSignature(): Promise<{ data: string; format: "JPEG" | "PNG" } | undefined> {
  billingSignature ??= !signatureUrl
    ? Promise.resolve(undefined)
    : fetch(signatureUrl)
        .then(async (response) => {
          if (!response.ok) return undefined;
          const mimeType = signaturePath?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
          return {
            data: `data:${mimeType};base64,${arrayBufferToBase64(await response.arrayBuffer())}`,
            format: mimeType === "image/png" ? "PNG" : "JPEG",
          } as const;
        })
        .catch(() => undefined);
  return billingSignature;
}

const money = (n: number) =>
  "PHP " + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DrawnQuoteCell = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PdfMergedCellRun = {
  value: string;
  startRow: number;
  endRow: number;
  cells: DrawnQuoteCell[];
};

function adjacentPdfValueRuns(items: Item[], field: "unit" | "passenger"): PdfMergedCellRun[] {
  const runs: PdfMergedCellRun[] = [];
  let startRow = 0;

  while (startRow < items.length) {
    const value = items[startRow]?.[field] ?? "";
    if (!value.trim()) {
      startRow += 1;
      continue;
    }

    let endRow = startRow;
    while (endRow + 1 < items.length && (items[endRow + 1]?.[field] ?? "") === value) {
      endRow += 1;
    }
    if (endRow > startRow) runs.push({ value, startRow, endRow, cells: [] });
    startRow = endRow + 1;
  }

  return runs;
}

function pdfRunByRow(runs: PdfMergedCellRun[]): Map<number, PdfMergedCellRun> {
  const byRow = new Map<number, PdfMergedCellRun>();
  for (const run of runs) {
    for (let row = run.startRow; row <= run.endRow; row += 1) {
      byRow.set(row, run);
    }
  }
  return byRow;
}

function quoteSharedColumnWidth(index: 1 | 3): number {
  return index === 1 ? 75 : 85;
}

function quoteSpanLines(doc: jsPDF, value: string, width: number, horizontalPadding: number): string[] {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return doc.splitTextToSize(value, width - horizontalPadding);
}

function drawMergedQuoteSpan(doc: jsPDF, cells: DrawnQuoteCell[], value: string, pageNumber: number) {
  const pageCells = cells.filter((cell) => cell.pageNumber === pageNumber);
  if (!pageCells.length) return;

  const first = pageCells[0];
  const top = Math.min(...pageCells.map((cell) => cell.y));
  const bottom = Math.max(...pageCells.map((cell) => cell.y + cell.height));
  const height = bottom - top;

  doc.setFillColor(255, 255, 255);
  doc.rect(first.x, top, first.width, height, "F");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.7);
  doc.rect(first.x, top, first.width, height, "S");
  doc.setTextColor(0, 0, 0);
  const lines = quoteSpanLines(doc, value, first.width, 12);
  const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor;
  const textY = top + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  doc.text(lines, first.x + first.width / 2, textY, { align: "center", baseline: "middle" });
}

export async function generatePdf(input: PdfInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 80;
  const marginR = 60;

  const [britannicBold, signature] = await Promise.all([
    loadBritannicBold(),
    input.docType === "billing" ? loadBillingSignature() : Promise.resolve(undefined),
  ]);
  doc.addFileToVFS("Britannic Bold Regular.ttf", britannicBold);
  doc.addFont("Britannic Bold Regular.ttf", "Britannic Bold", "normal");

  // Header — big bold title
  doc.setFont("Britannic Bold", "normal");
  doc.setFontSize(22);
  doc.text("TDA CAR RENTAL SERVICES", marginL, 90);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = 110;
  const lineGap = 13;
  doc.text("Non-VAT Reg. TIN: 209-021-244-0000", marginL, y); y += lineGap;
  doc.text("2746 Rizal Avenue East Bajac Bajac 2200", marginL, y); y += lineGap;
  doc.text("Olongapo City Zambales, Philippines", marginL, y); y += lineGap;
  doc.text("TEDDY T. DIMATE, JR.", marginL, y);

  y = 200;
  doc.text(`Date: ${input.date}`, marginL, y);
  y += 24;

  if (input.docType === "billing") {
    doc.text("Billed To:", marginL, y); y += lineGap;
    doc.text(input.billedTo || "", marginL, y); y += 24;
    doc.text("DETAILS: CAR RENTAL SERVICES", marginL, y); y += 30;
    doc.text(`Driver: ${input.driver || ""}`, marginL, y); y += 14;
  } else {
    doc.text("QUOTATION REQUEST", marginL, y); y += lineGap;
    doc.text(`Requestor: ${input.requestor || ""}`, marginL, y); y += 24;
  }

  const tableStartY = y;
  const tableItems = input.items.map((item) => ({ ...item, unit: item.unit ?? input.unit }));
  const unitRuns = adjacentPdfValueRuns(tableItems, "unit");
  const passengerRuns = adjacentPdfValueRuns(tableItems, "passenger");
  const unitRunsByRow = pdfRunByRow(unitRuns);
  const passengerRunsByRow = pdfRunByRow(passengerRuns);
  const runForPdfCell = (column: number, row: number) => {
    if (column === 1) return unitRunsByRow.get(row);
    if (column === 3) return passengerRunsByRow.get(row);
    return undefined;
  };
  const head = [["DATE", "UNIT", "DESTINATION", "PASSENGER", "AMOUNT"]];
  const body = tableItems.map((item) => [
    item.date,
    item.unit || "",
    item.destination,
    item.passenger,
    money(item.amount),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    theme: "grid",
    margin: { left: 80, right: 80 },
    styles: {
      font: "helvetica",
      fontSize: 10,
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.7,
      textColor: [0, 0, 0],
      cellPadding: 6,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineWidth: 0.7,
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 75 },
      2: { cellWidth: 140, halign: "center" },
      3: { cellWidth: 85 },
      4: { cellWidth: 82 },
    },
    didParseCell: (data) => {
      const run = data.section === "body" ? runForPdfCell(data.column.index, data.row.index) : undefined;
      if (run) {
        const column = data.column.index as 1 | 3;
        const lines = quoteSpanLines(
          data.doc,
          run.value,
          quoteSharedColumnWidth(column),
          data.cell.padding("horizontal"),
        );
        const minimumHeight =
          lines.length * (data.doc.getLineHeight() / data.doc.internal.scaleFactor) + data.cell.padding("vertical");
        data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight, minimumHeight);
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const cell = {
        pageNumber: data.pageNumber,
        x: data.cell.x,
        y: data.cell.y,
        width: data.cell.width,
        height: data.cell.height,
      };
      const run = runForPdfCell(data.column.index, data.row.index);
      if (run) run.cells.push(cell);
    },
    didDrawPage: (data) => {
      for (const run of [...unitRuns, ...passengerRuns]) {
        drawMergedQuoteSpan(doc, run.cells, run.value, data.pageNumber);
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let afterY = (doc as any).lastAutoTable.finalY + 14;
  const footerY = pageH - 90;

  if (input.docType === "billing" && afterY + 126 > footerY - 12) {
    doc.addPage();
    afterY = marginL;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);

  if (input.docType === "billing") {
    doc.text("********NOTHING FOLLOWS******", marginL, afterY);
    afterY += 30;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text("TOTAL AMOUNT DUE:", marginL, afterY);
    const total = input.items.reduce((s, i) => s + i.amount, 0);
    doc.text(money(total), marginL + 220, afterY);
    afterY += 34;
    if (signature) {
      doc.addImage(signature.data, signature.format, marginL + 220, afterY - 30, 120, 80);
    }
    doc.setFontSize(10);
    doc.text("PAYMENT DETAILS:", marginL, afterY); afterY += lineGap;
    doc.text("PLEASE DEPOSIT PAYMENT TO:", marginL, afterY); afterY += lineGap;
    doc.text("BANK: BANK OF THE PHILIPPINE ISLAND", marginL, afterY); afterY += lineGap;
    doc.text("ACCOUNT NAME: TEDDY T. DIMATE, JR.", marginL, afterY); afterY += lineGap;
    doc.text("ACCOUNT NUMBER: 1849095435", marginL, afterY);
  } else {
    doc.setFont("helvetica", "italic");
    doc.text("* Note: Additional booked trips will incur additional costs.", marginL, afterY);
    afterY += lineGap;
    doc.setFont("helvetica", "normal");
    doc.text("Rates are still subject to change.", marginL, afterY);
    afterY += 34;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ESTIMATED TOTAL:", marginL, afterY);
    doc.setFont("helvetica", "normal");
    const total = input.items.reduce((s, i) => s + i.amount, 0);
    doc.text(money(total), marginL + 220, afterY);
  }

  // Footer
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("TDA CAR RENTAL SERVICES", pageW / 2, footerY, { align: "center" });
  doc.setFontSize(12);
  doc.text("+63 933 663 4655 / +63 966 583 533", pageW / 2, footerY + 18, { align: "center" });
  doc.text("tdacarrental@gmail.com", pageW / 2, footerY + 36, { align: "center" });

  return doc;
}
