import { PDFDocument, StandardFonts } from 'pdf-lib';

export const generateInvoicePdf = async (data: {
  tenantName: string;
  clientName: string;
  monthRef: string;
  durationSeconds: number;
  amountCents: number;
}): Promise<Buffer> => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

  page.drawText('TrackFlow Fatura', { x: 50, y: 800, size: 24, font });
  page.drawText(`Empresa: ${data.tenantName}`, { x: 50, y: 770, size: fontSize, font });
  page.drawText(`Cliente: ${data.clientName}`, { x: 50, y: 755, size: fontSize, font });
  page.drawText(`Período: ${data.monthRef}`, { x: 50, y: 740, size: fontSize, font });
  page.drawText(`Duração: ${formatTime(data.durationSeconds)}`, { x: 50, y: 725, size: fontSize, font });
  page.drawText(`Total: ${formatCurrency(data.amountCents)}`, { x: 50, y: 710, size: fontSize, font });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};
