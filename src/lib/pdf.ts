// PDF generation matching the reference layout (TDA Car Rental Services).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Item } from "./db";

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

function loadBritannicBold(): Promise<string> {
  britannicBoldBase64 ??= fetch("/Britannic%20Bold%20Regular.ttf")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Could not load Britannic Bold for PDF generation.");
      }
      return response.arrayBuffer();
    })
    .then((fontData) => {
      let binary = "";
      for (const byte of new Uint8Array(fontData)) {
        binary += String.fromCharCode(byte);
      }
      return btoa(binary);
    });
  return britannicBoldBase64;
}

const money = (n: number) =>
  "PHP " + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function generatePdf(input: PdfInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 80;
  const marginR = 60;

  const britannicBold = await loadBritannicBold();
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
    doc.text(`Unit Used: ${input.unit}`, marginL, y); y += lineGap;
    doc.text(`Driver: ${input.driver || ""}`, marginL, y); y += 14;
  } else {
    doc.text("QUOTATION REQUEST", marginL, y); y += lineGap;
    doc.text(`Unit Requested: ${input.unit}`, marginL, y); y += 24;
  }

  const tableStartY = y;
  const isQuote = input.docType === "quotation";
  const head = isQuote
    ? [["DATE", "DESTINATION", "PASSENGER", "AMOUNT", "Requestor"]]
    : [["DATE", "DESTINATION", "PASSENGER", "AMOUNT"]];

  const body = input.items.map((it) => {
    const base = [it.date, it.destination, it.passenger, money(it.amount)];
    return isQuote ? [...base, ""] : base;
  });

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    theme: "grid",
    margin: { left: marginL, right: marginR },
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
    columnStyles: isQuote
      ? {
          0: { cellWidth: 70 },
          1: { cellWidth: 170, halign: "center" },
          2: { cellWidth: 80 },
          3: { cellWidth: 85 },
          4: { cellWidth: 70 },
        }
      : {
          0: { cellWidth: 80 },
          1: { cellWidth: 230, halign: "center" },
          2: { cellWidth: 90 },
          3: { cellWidth: 95 },
        },
    didParseCell: (data) => {
      // Merge Requestor column vertically for quotations by only showing text on first body row
      if (isQuote && data.section === "body" && data.column.index === 4) {
        if (data.row.index === 0) {
          data.cell.text = [input.requestor || ""];
          data.cell.styles.valign = "middle";
        } else {
          data.cell.text = [""];
        }
      }
    },
    willDrawCell: (data) => {
      // Remove internal horizontal borders in Requestor column to visually merge
      if (isQuote && data.section === "body" && data.column.index === 4) {
        if (data.row.index !== 0) {
          // draw white line over top border after cell draws
        }
      }
    },
    didDrawCell: (data) => {
      if (isQuote && data.section === "body" && data.column.index === 4 && data.row.index > 0) {
        const { x, y, width } = data.cell;
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1);
        doc.line(x + 0.5, y, x + width - 0.5, y);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.7);
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let afterY = (doc as any).lastAutoTable.finalY + 14;

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
  const footerY = pageH - 90;
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("TDA CAR RENTAL SERVICES", pageW / 2, footerY, { align: "center" });
  doc.setFontSize(12);
  doc.text("+63 933 663 4655 / +63 966 583 533", pageW / 2, footerY + 18, { align: "center" });
  doc.text("tdacarrental@gmail.com", pageW / 2, footerY + 36, { align: "center" });

  return doc;
}
