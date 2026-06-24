const PDFDocument = require('pdfkit');

// Shared layout primitives for generating "global standard" commercial
// documents (Purchase Order, Purchase Requisition) as PDF. Built directly on
// pdfkit's low-level drawing API (no template engine / headless browser
// dependency) — every helper takes and returns explicit y-coordinates so
// sections can be composed predictably instead of fighting pdfkit's own
// auto-flow cursor.

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COLOR_TEXT = '#1a1a1a';
const COLOR_MUTED = '#666666';
const COLOR_BORDER = '#999999';
const COLOR_HEADER_BG = '#eef1f5';

function newDocument() {
  return new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
}

function fmtMoney(n, currency = 'INR') {
  // PDFKit's standard 14 fonts (Helvetica) only cover WinAnsi — no ₹ glyph —
  // so amounts use a plain currency code prefix instead of a symbol.
  return `${currency} ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Title banner — company identity on the left, document number/date/status
// key-value block on the right. Returns the y position to continue from.
function drawDocumentHeader(doc, { companyName, companyLine, title, fields }) {
  const startY = MARGIN;
  doc.fontSize(16).font('Helvetica-Bold').fillColor(COLOR_TEXT).text(companyName || 'ProcureTrack', MARGIN, startY, { width: 280 });
  let leftY = doc.y;
  if (companyLine) {
    doc.fontSize(8.5).font('Helvetica').fillColor(COLOR_MUTED).text(companyLine, MARGIN, leftY + 2, { width: 280 });
    leftY = doc.y;
  }

  const rightX = MARGIN + 250;
  const rightWidth = CONTENT_WIDTH - 250;
  doc.fontSize(16).font('Helvetica-Bold');
  const titleHeight = doc.heightOfString(title, { width: rightWidth, align: 'right' });
  doc.fillColor(COLOR_TEXT).text(title, rightX, startY, { width: rightWidth, align: 'right' });
  let fy = startY + titleHeight + 10;
  doc.fontSize(9);
  for (const [label, value] of fields) {
    doc.font('Helvetica').fillColor(COLOR_MUTED).text(label, rightX, fy, { width: rightWidth * 0.45, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXT).text(String(value ?? '—'), rightX + rightWidth * 0.45 + 6, fy, { width: rightWidth * 0.55 - 6, align: 'right' });
    fy += 13;
  }

  const y = Math.max(leftY, fy) + 8;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).strokeColor(COLOR_TEXT).lineWidth(1.4).stroke();
  return y + 14;
}

// Two label/value columns side by side (e.g. "Vendor" details | "Buyer" details).
function drawTwoColumnBlock(doc, y, left, right) {
  const colWidth = CONTENT_WIDTH / 2 - 10;
  const rightX = MARGIN + CONTENT_WIDTH / 2 + 10;

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(COLOR_TEXT).text(left.title, MARGIN, y, { width: colWidth });
  doc.text(right.title, rightX, y, { width: colWidth });

  let ly = y + 14, ry = y + 14;
  doc.fontSize(8.5).font('Helvetica');
  for (const [label, value] of left.rows) {
    doc.fillColor(COLOR_MUTED).text(`${label}: `, MARGIN, ly, { width: colWidth, continued: true });
    doc.fillColor(COLOR_TEXT).text(String(value ?? '—'));
    ly += 13;
  }
  for (const [label, value] of right.rows) {
    doc.fillColor(COLOR_MUTED).text(`${label}: `, rightX, ry, { width: colWidth, continued: true });
    doc.fillColor(COLOR_TEXT).text(String(value ?? '—'));
    ry += 13;
  }
  return Math.max(ly, ry) + 8;
}

// A single full-width label/value grid (3 per row), for compact metadata strips.
function drawFieldGrid(doc, y, fields, perRow = 3) {
  const colWidth = CONTENT_WIDTH / perRow;
  let x = MARGIN, rowY = y, count = 0;
  doc.fontSize(8.5);
  for (const [label, value] of fields) {
    doc.font('Helvetica').fillColor(COLOR_MUTED).text(`${label}`, x, rowY, { width: colWidth - 8 });
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXT).text(String(value ?? '—'), x, doc.y, { width: colWidth - 8 });
    count++;
    if (count % perRow === 0) {
      x = MARGIN;
      rowY = doc.y + 8;
    } else {
      x += colWidth;
    }
  }
  return (count % perRow === 0 ? rowY : doc.y + 8);
}

function drawSectionTitle(doc, y, text) {
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_TEXT).text(text, MARGIN, y);
  const ny = doc.y + 4;
  doc.moveTo(MARGIN, ny).lineTo(MARGIN + CONTENT_WIDTH, ny).strokeColor('#cccccc').lineWidth(0.7).stroke();
  return ny + 8;
}

// Simple bordered grid table — fixed row height, single-line cells (ellipsis
// on overflow). columns: [{ title, width, align }]; rows: array of arrays of
// cell text. Handles page breaks by re-drawing the header row on the new page.
function drawTable(doc, y, { columns, rows, rowHeight = 18, headerHeight = 20 }) {
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  function drawHeaderRow(headerY) {
    doc.rect(MARGIN, headerY, tableWidth, headerHeight).fill(COLOR_HEADER_BG);
    doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(8);
    let x = MARGIN;
    for (const col of columns) {
      doc.text(col.title, x + 4, headerY + 6, { width: col.width - 8, align: col.align || 'left' });
      x += col.width;
    }
    doc.strokeColor(COLOR_BORDER).lineWidth(0.7).rect(MARGIN, headerY, tableWidth, headerHeight).stroke();
    return headerY + headerHeight;
  }

  let cursorY = drawHeaderRow(y);
  doc.font('Helvetica').fontSize(8);

  for (const row of rows) {
    if (cursorY + rowHeight > pageBottom) {
      doc.addPage();
      cursorY = drawHeaderRow(doc.page.margins.top);
      doc.font('Helvetica').fontSize(8);
    }
    let x = MARGIN;
    doc.strokeColor('#dddddd').lineWidth(0.5).rect(MARGIN, cursorY, tableWidth, rowHeight).stroke();
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      doc.fillColor(COLOR_TEXT).text(String(row[i] ?? ''), x + 4, cursorY + 4, { width: col.width - 8, align: col.align || 'left', ellipsis: true, lineBreak: false });
      if (i > 0) doc.moveTo(x, cursorY).lineTo(x, cursorY + rowHeight).strokeColor('#dddddd').lineWidth(0.5).stroke();
      x += col.width;
    }
    cursorY += rowHeight;
  }
  return cursorY + 10;
}

// Right-aligned label/value totals block (Subtotal / Tax / Grand Total style).
function drawTotalsBlock(doc, y, lines) {
  const blockWidth = 220;
  const x = MARGIN + CONTENT_WIDTH - blockWidth;
  let cursorY = y;
  for (const [label, value, emphasize] of lines) {
    doc.fontSize(emphasize ? 10.5 : 9).font(emphasize ? 'Helvetica-Bold' : 'Helvetica');
    doc.fillColor(emphasize ? COLOR_TEXT : COLOR_MUTED).text(label, x, cursorY, { width: blockWidth * 0.5, align: 'left' });
    doc.fillColor(COLOR_TEXT).text(String(value), x + blockWidth * 0.5, cursorY, { width: blockWidth * 0.5, align: 'right' });
    cursorY += emphasize ? 16 : 13;
  }
  return cursorY + 8;
}

// Two signature blocks side by side at the bottom of the document.
function drawSignatureBlock(doc, y, leftLabel, rightLabel) {
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  let sigY = Math.max(y, pageBottom - 70);
  if (sigY + 60 > pageBottom) { doc.addPage(); sigY = doc.page.margins.top; }
  const colWidth = CONTENT_WIDTH / 2 - 20;
  doc.moveTo(MARGIN, sigY + 40).lineTo(MARGIN + colWidth, sigY + 40).strokeColor('#888888').lineWidth(0.7).stroke();
  doc.moveTo(MARGIN + CONTENT_WIDTH - colWidth, sigY + 40).lineTo(MARGIN + CONTENT_WIDTH, sigY + 40).strokeColor('#888888').lineWidth(0.7).stroke();
  doc.fontSize(8.5).font('Helvetica').fillColor(COLOR_MUTED);
  doc.text(leftLabel, MARGIN, sigY + 44, { width: colWidth });
  doc.text(rightLabel, MARGIN + CONTENT_WIDTH - colWidth, sigY + 44, { width: colWidth });
  return sigY + 60;
}

function drawFooterNote(doc, text) {
  const pageBottom = doc.page.height - doc.page.margins.bottom + 20;
  doc.fontSize(7).font('Helvetica-Oblique').fillColor('#999999')
    .text(text, MARGIN, pageBottom, { width: CONTENT_WIDTH, align: 'center' });
}

module.exports = {
  newDocument, fmtMoney, fmtDate,
  drawDocumentHeader, drawTwoColumnBlock, drawFieldGrid, drawSectionTitle,
  drawTable, drawTotalsBlock, drawSignatureBlock, drawFooterNote,
  MARGIN, CONTENT_WIDTH,
};
