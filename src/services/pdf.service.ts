import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export interface InvoicePdfData {
  tenantName: string;
  clientName: string;
  monthRef: string;
  durationSeconds: number;
  amountCents: number;
  status?: string;
  aiSummary?: string | null;
}

const e = React.createElement;

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatCurrency(cents: number): string {
  const reais = (Number(cents) || 0) / 100;
  return `R$ ${reais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#f8fafc",
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#1e293b",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 28,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #10b981",
    paddingBottom: 14,
    marginBottom: 22,
  },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  brandSub: { fontSize: 10, color: "#64748b", marginTop: 4 },
  statusBadge: {
    backgroundColor: "#ecfdf5",
    color: "#047857",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    alignSelf: "flex-end",
  },
  refText: { fontSize: 10, color: "#64748b", marginTop: 6, textAlign: "right" },
  label: {
    fontSize: 9,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  clientName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  section: { marginBottom: 22 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottom: "1px solid #cbd5e1",
  },
  tableBodyRow: {
    flexDirection: "row",
    borderBottom: "1px solid #e2e8f0",
  },
  th: {
    padding: 10,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
  },
  td: { padding: 12, fontSize: 11 },
  colDesc: { flex: 3 },
  colTime: { flex: 1, textAlign: "right" },
  colValue: { flex: 1, textAlign: "right" },
  tdTime: { fontFamily: "Helvetica-Bold" },
  tdValue: { fontFamily: "Helvetica-Bold", color: "#047857", fontSize: 12 },
  aiBox: {
    backgroundColor: "#f8fafc",
    borderLeft: "4px solid #10b981",
    borderRadius: 6,
    padding: 14,
    marginBottom: 22,
  },
  aiTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 6,
  },
  aiText: { fontSize: 11, color: "#334155", lineHeight: 1.5 },
  footer: {
    marginTop: 24,
    fontSize: 9,
    color: "#94a3b8",
    textAlign: "center",
  },
});

function InvoiceDocument(data: InvoicePdfData) {
  const formattedHours = formatTime(data.durationSeconds);
  const formattedValue = formatCurrency(data.amountCents);
  const status = (data.status || "pendente").toString();

  return e(
    Document,
    null,
    e(
      Page,
      { size: "A4", style: styles.page },
      e(
        View,
        { style: styles.card },
        e(
          View,
          { style: styles.header },
          e(
            View,
            null,
            e(Text, { style: styles.brand }, "TrackFlow"),
            e(
              Text,
              { style: styles.brandSub },
              `Emitido por: ${data.tenantName}`,
            ),
          ),
          e(
            View,
            null,
            e(Text, { style: styles.statusBadge }, status),
            e(Text, { style: styles.refText }, `Ref: ${data.monthRef}`),
          ),
        ),
        e(
          View,
          { style: styles.section },
          e(Text, { style: styles.label }, "Cliente"),
          e(Text, { style: styles.clientName }, data.clientName),
        ),
        e(
          View,
          { style: styles.section },
          e(
            View,
            { style: styles.tableHeaderRow },
            e(Text, { style: [styles.th, styles.colDesc] }, "Descrição"),
            e(Text, { style: [styles.th, styles.colTime] }, "Tempo Apurado"),
            e(Text, { style: [styles.th, styles.colValue] }, "Valor Total"),
          ),
          e(
            View,
            { style: styles.tableBodyRow },
            e(
              Text,
              { style: [styles.td, styles.colDesc] },
              `Prestação de Serviços (${data.monthRef})`,
            ),
            e(
              Text,
              { style: [styles.td, styles.colTime, styles.tdTime] },
              formattedHours,
            ),
            e(
              Text,
              { style: [styles.td, styles.colValue, styles.tdValue] },
              formattedValue,
            ),
          ),
        ),
        data.aiSummary
          ? e(
              View,
              { style: styles.aiBox },
              e(
                Text,
                { style: styles.aiTitle },
                "Resumo Executivo das Entregas (IA)",
              ),
              e(Text, { style: styles.aiText }, String(data.aiSummary)),
            )
          : null,
        e(
          Text,
          { style: styles.footer },
          "Documento gerado automaticamente pela plataforma TrackFlow SaaS.",
        ),
      ),
    ),
  );
}

export const generateInvoicePdf = async (
  data: InvoicePdfData,
): Promise<Buffer> => {
  return renderToBuffer(InvoiceDocument(data));
};
