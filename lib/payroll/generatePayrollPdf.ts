import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PITS_COLORS } from '@/lib/constants/colorTokens';
import type { CoachPayrollReport } from './payrollReport';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const BRAND_HEADER_RGB = hexToRgb(PITS_COLORS.primary);
const BRAND_HEADER_TEXT_RGB = hexToRgb(PITS_COLORS.darkText);

function addCoachSection(doc: jsPDF, report: CoachPayrollReport, startY: number): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(report.coachName, 14, startY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${report.periodLabel}`, 14, startY + 6);

  autoTable(doc, {
    startY: startY + 12,
    head: [['Date', 'Time', 'Class', 'Pay (USD)']],
    body:
      report.lines.length > 0
        ? report.lines.map((line) => [
            line.date,
            line.time,
            line.classType,
            `$${line.rateUsd.toFixed(2)}`,
          ])
        : [['—', '—', 'No confirmed classes', '$0.00']],
    styles: { fontSize: 9 },
    headStyles: { fillColor: BRAND_HEADER_RGB, textColor: BRAND_HEADER_TEXT_RGB },
  });

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: $${report.totalUsd.toFixed(2)}`, 14, finalY + 8);

  return finalY + 18;
}

export function generateCoachPayrollPdf(report: CoachPayrollReport): Uint8Array {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Payroll Report', 14, 20);

  addCoachSection(doc, report, 30);

  return new Uint8Array(doc.output('arraybuffer'));
}

export function generateFullPayrollPdf(reports: CoachPayrollReport[]): Uint8Array {
  const doc = new jsPDF();
  const periodLabel = reports[0]?.periodLabel ?? '';

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Payroll Report — All Coaches', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${periodLabel}`, 14, 28);

  const grandTotal = reports.reduce((sum, r) => sum + r.totalUsd, 0);
  doc.text(`Grand Total: $${grandTotal.toFixed(2)}`, 14, 34);

  let y = 44;

  reports.forEach((report, index) => {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    y = addCoachSection(doc, report, y);
    if (index < reports.length - 1) {
      y += 4;
    }
  });

  return new Uint8Array(doc.output('arraybuffer'));
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
