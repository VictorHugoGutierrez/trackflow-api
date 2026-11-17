import { Request, Response } from "express";
import { Ollama } from "ollama";
import { Resend } from "resend";
import { InvoiceStatus } from "@prisma/client";
import React from "react";
import { InvoiceModel } from "../models/invoice.model.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../errors/app-error.js";
import {
  calculateAmountCents,
  formatCurrencyBRL,
  formatDurationHMS,
  formatDurationHuman,
  parseReaisToCents,
} from "../utils/formatters.js";


interface AiInsightBody {
  clientId?: string;
  projectId?: string;
  monthRef?: string;
  startDate?: string;
  endDate?: string;
  prompt?: string;
  activities?: Array<{
    project?: string;
    description?: string;
    hours?: number;
    durationSeconds?: number;
  }>;
}

interface GenerateInvoiceBody {
  clientId: string;
  monthRef: string;
  startDate?: string;
  endDate?: string;
  durationSeconds?: number;
  amountCents?: number;
  totalHours?: number;
  totalValue?: number;
  hourlyRateCents?: number;
  hourlyRate?: number;
  aiSummary?: string;
  generateAi?: boolean;
  pdfUrl?: string;
  sendEmail?: boolean;
  recipientEmail?: string;
}

interface SendInvoiceBody {
  to?: string;
  recipientEmail?: string;
  subject?: string;
}

async function runOllamaPrompt(prompt: string): Promise<string> {
  const ollama = new Ollama({
    host: "https://ollama.com",
    headers: {
      Authorization: "Bearer " + (process.env.OLLAMA_API_KEY || ""),
    },
  });

  const response = await ollama.chat({
    model: "gpt-oss:120b",
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let content = "";
  for await (const part of response) {
    if (part.message?.content) {
      content += part.message.content;
    }
  }

  return content.trim();
}

function createResendClient(): Resend {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new AppError(
      "CONFIG_ERROR",
      "Variável de ambiente RESEND_API_KEY não configurada.",
      500,
    );
  }
  return new Resend(resendApiKey);
}

function buildInvoiceHtml(params: {
  invoiceId?: string;
  tenantName: string;
  clientName: string;
  monthRef: string;
  durationSeconds: number;
  amountCents: number;
  status: string;
  aiSummary?: string | null;
}) {
  const formattedHours = formatDurationHMS(params.durationSeconds);
  const formattedValue = formatCurrencyBRL(params.amountCents);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Fatura TrackFlow - ${params.monthRef}</title>
</head>
<body style="font-family: Arial, sans-serif; color: #1e293b; max-width: 680px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
  <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 24px;">
      <div>
        <h1 style="margin: 0; color: #0f172a; font-size: 24px;">TrackFlow</h1>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">Emitido por: <strong>${params.tenantName}</strong></p>
      </div>
      <div style="text-align: right;">
        <span style="background: #ecfdf5; color: #047857; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
          ${params.status}
        </span>
        <p style="margin: 8px 0 0; color: #64748b; font-size: 13px;">Ref: <strong>${params.monthRef}</strong></p>
      </div>
    </div>

    <div style="margin-bottom: 24px;">
      <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase;">Cliente</p>
      <h2 style="margin: 0; color: #0f172a; font-size: 18px;">${params.clientName}</h2>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #f1f5f9; text-align: left;">
          <th style="padding: 12px; font-size: 13px; color: #475569; border-bottom: 1px solid #cbd5e1;">Descrição</th>
          <th style="padding: 12px; font-size: 13px; color: #475569; border-bottom: 1px solid #cbd5e1; text-align: right;">Tempo Apurado</th>
          <th style="padding: 12px; font-size: 13px; color: #475569; border-bottom: 1px solid #cbd5e1; text-align: right;">Valor Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">Prestação de Serviços (${params.monthRef})</td>
          <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: right; font-weight: bold;">${formattedHours}</td>
          <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; font-size: 16px; text-align: right; font-weight: bold; color: #047857;">${formattedValue}</td>
        </tr>
      </tbody>
    </table>

    ${
      params.aiSummary
        ? `<div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 8px; font-size: 14px; color: #0f172a;">Resumo Executivo das Entregas (IA)</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #334155;">${params.aiSummary.replace(/\n/g, "<br/>")}</p>
          </div>`
        : ""
    }

    <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
      Documento gerado automaticamente pela plataforma TrackFlow SaaS.
    </p>
  </div>
</body>
</html>`;
}

export class InvoiceController {
  static async getReportSummary(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const userId = req.user!.sub;

    const clientId =
      typeof req.query.clientId === "string" ? req.query.clientId : undefined;
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const startDate = req.query.startDate
      ? new Date(String(req.query.startDate))
      : undefined;
    const endDate = req.query.endDate
      ? new Date(String(req.query.endDate))
      : undefined;

    let hourlyRateCents: number | undefined = undefined;
    if (req.query.hourlyRateCents !== undefined) {
      const parsed = Number(req.query.hourlyRateCents);
      if (!isNaN(parsed)) hourlyRateCents = Math.round(parsed);
    } else if (req.query.hourlyRate !== undefined) {
      hourlyRateCents = parseReaisToCents(req.query.hourlyRate);
    }

    const summary = await InvoiceModel.getReportSummary({
      tenantId,
      userId,
      clientId,
      projectId,
      startDate: startDate && !isNaN(startDate.getTime()) ? startDate : undefined,
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
      hourlyRateCents,
    });

    return res.json({
      success: true,
      data: summary,
    });
  }

  static async generateAiInsight(
    req: Request<{}, {}, AiInsightBody>,
    res: Response,
  ) {
    const tenantId = req.user!.tenantId as string;
    const {
      clientId,
      projectId,
      monthRef,
      startDate,
      endDate,
      prompt: customPrompt,
      activities,
    } = req.body || {};

    let clientName = "Cliente";
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, tenantId },
      });
      if (!client) {
        throw new AppError(
          "CLIENT_NOT_FOUND",
          "Cliente não encontrado neste workspace.",
          404,
        );
      }
      clientName = client.name;
    }

    const where: any = {
      tenantId,
      end: { not: null },
    };

    if (projectId) {
      where.projectId = projectId;
    }
    if (clientId) {
      where.project = { clientId };
    }
    if (startDate || endDate) {
      where.start = {};
      if (startDate) where.start.gte = new Date(startDate);
      if (endDate) where.start.lte = new Date(endDate);
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: {
          include: { client: true },
        },
      },
      orderBy: { start: "asc" },
    });

    const totalDurationSeconds = timeEntries.reduce(
      (acc, entry) => acc + (entry.durationSeconds || 0),
      0,
    );
    const totalHours = Number((totalDurationSeconds / 3600).toFixed(2));
    const formattedDuration = formatDurationHMS(totalDurationSeconds);
    const humanDuration = formatDurationHuman(totalDurationSeconds);

    let descriptions = "";
    if (Array.isArray(activities) && activities.length > 0) {
      descriptions = activities
        .map((a) => {
          const dur =
            a.durationSeconds !== undefined
              ? formatDurationHuman(a.durationSeconds)
              : `${a.hours ?? 0}h`;
          return `- [${a.project || "Projeto"}] ${a.description || "Atividade"} (${dur})`;
        })
        .join("\n");
    } else {
      descriptions = timeEntries
        .map(
          (entry) =>
            `- [${entry.project?.name || "Geral"}] ${entry.description || "Desenvolvimento e entregas"} (${formatDurationHuman(entry.durationSeconds)})`,
        )
        .slice(0, 40)
        .join("\n");
    }

    const finalPrompt =
      customPrompt ||
      `Você é um assistente executivo financeiro da plataforma TrackFlow.
Redija um resumo executivo profissional, claro e persuasivo em português para compor a fatura de serviços do cliente "${clientName}".
Período de referência: ${monthRef || "Período atual"}
Tempo total trabalhado: ${humanDuration} (${formattedDuration}).
Atividades registradas:
${descriptions || "- Desenvolvimento técnico, acompanhamento de projeto e entregas planejadas."}

Instruções:
- Escreva de 2 a 3 parágrafos curtos em tom corporativo.
- Destaque o valor gerado pelas entregas e a transparência na apuração das horas.
- Não invente valores monetários que não foram fornecidos; foque nas entregas e no tempo dedicado (${humanDuration}).`;

    let aiSummaryText = "";

    try {
      aiSummaryText = await runOllamaPrompt(finalPrompt);
    } catch (err: any) {
      console.error("Erro na chamada ao Ollama:", err?.message || err);
      aiSummaryText = `Resumo Executivo de Entregas - ${clientName}\n\nDurante o período de referência (${monthRef || "mensal"}), foram dedicadas ${humanDuration} (${formattedDuration}) em atividades técnicas e operacionais vinculadas aos projetos contratados. Todas as entregas seguiram o cronograma estabelecido com apontamento auditado na plataforma TrackFlow.`;
    }

    return res.json({
      success: true,
      data: {
        clientId: clientId || null,
        clientName,
        monthRef: monthRef || "",
        durationSeconds: totalDurationSeconds,
        formattedDuration,
        totalHours,
        totalEntries: timeEntries.length,
        summary: aiSummaryText,
        insight: aiSummaryText,
      },
    });
  }

  static async generateInvoice(
    req: Request<{}, {}, GenerateInvoiceBody>,
    res: Response,
  ) {
    const tenantId = req.user!.tenantId as string;
    const userId = req.user!.sub;
    const {
      clientId,
      monthRef,
      startDate,
      endDate,
      durationSeconds: rawDurationSeconds,
      amountCents: rawAmountCents,
      totalHours: bodyHours,
      totalValue: bodyValue,
      hourlyRateCents: bodyRateCents,
      hourlyRate: bodyRateReais,
      aiSummary: bodyAiSummary,
      generateAi,
      pdfUrl: bodyPdfUrl,
      sendEmail,
      recipientEmail,
    } = req.body || {};

    if (!clientId || !monthRef) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Os campos 'clientId' e 'monthRef' são obrigatórios.",
        400,
      );
    }

    const [client, tenant] = await Promise.all([
      prisma.client.findFirst({ where: { id: clientId, tenantId } }),
      prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);

    if (!client) {
      throw new AppError(
        "CLIENT_NOT_FOUND",
        "Cliente não encontrado neste workspace.",
        404,
      );
    }

    let finalDurationSeconds =
      rawDurationSeconds !== undefined
        ? Math.max(0, Math.round(Number(rawDurationSeconds)))
        : bodyHours !== undefined
          ? Math.max(0, Math.round(Number(bodyHours) * 3600))
          : undefined;

    let finalAmountCents =
      rawAmountCents !== undefined
        ? Math.max(0, Math.round(Number(rawAmountCents)))
        : bodyValue !== undefined
          ? parseReaisToCents(bodyValue)
          : undefined;

    const requestedRateCents =
      bodyRateCents !== undefined
        ? Math.max(0, Math.round(Number(bodyRateCents)))
        : bodyRateReais !== undefined
          ? parseReaisToCents(bodyRateReais)
          : undefined;

    if (finalDurationSeconds === undefined || finalAmountCents === undefined) {
      const summary = await InvoiceModel.getReportSummary({
        tenantId,
        userId,
        clientId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        hourlyRateCents: requestedRateCents,
      });

      if (finalDurationSeconds === undefined) {
        finalDurationSeconds =
          summary.billableSeconds || summary.durationSeconds || 0;
      }
      if (finalAmountCents === undefined) {
        const effectiveRateCents = requestedRateCents ?? summary.hourlyRateCents;
        finalAmountCents =
          summary.amountCents > 0
            ? summary.amountCents
            : calculateAmountCents(finalDurationSeconds, effectiveRateCents);
      }
    }

    let finalAiSummary = bodyAiSummary;
    if (!finalAiSummary && generateAi) {
      try {
        finalAiSummary = await runOllamaPrompt(
          `Gere um resumo executivo curto em português (2 parágrafos) para a fatura do cliente "${client.name}" referente a ${monthRef}, totalizando ${formatDurationHuman(finalDurationSeconds)} trabalhadas e ${formatCurrencyBRL(finalAmountCents)}.`,
        );
      } catch {
        finalAiSummary = `Serviços prestados ao cliente ${client.name} durante ${monthRef}, totalizando ${formatDurationHuman(finalDurationSeconds)} apuradas.`;
      }
    }

    const htmlDocument = buildInvoiceHtml({
      tenantName: tenant?.name || "TrackFlow Workspace",
      clientName: client.name,
      monthRef,
      durationSeconds: finalDurationSeconds,
      amountCents: finalAmountCents,
      status: "pendente",
      aiSummary: finalAiSummary,
    });

    const generatedPdfUrl =
      bodyPdfUrl ||
      `data:text/html;base64,${Buffer.from(htmlDocument, "utf-8").toString("base64")}`;

    const invoice = await InvoiceModel.create({
      tenantId,
      clientId,
      monthRef,
      durationSeconds: finalDurationSeconds,
      amountCents: finalAmountCents,
      aiSummary: finalAiSummary,
      pdfUrl: generatedPdfUrl,
    });

    let emailResult: any = null;
    if (sendEmail) {
      const targetEmail =
        recipientEmail ||
        (client.contact && client.contact.includes("@") ? client.contact : null) ||
        "hugovictorgutierrez@gmail.com";

      const resend = createResendClient();

      const sent = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: targetEmail,
        subject: `Fatura TrackFlow - ${monthRef} - ${client.name}`,
        html: htmlDocument,
      });

      emailResult = sent;
    }

    return res.status(201).json({
      success: true,
      data: {
        invoice,
        ...(emailResult ? { email: emailResult } : {}),
      },
    });
  }

  static async sendInvoice(
    req: Request<{ id: string }, {}, SendInvoiceBody>,
    res: Response,
  ) {
    const tenantId = req.user!.tenantId as string;
    const { id } = req.params;
    const { to, recipientEmail, subject } = req.body || {};

    const invoice = await InvoiceModel.findById(id, tenantId);
    if (!invoice) {
      throw new AppError(
        "INVOICE_NOT_FOUND",
        "Fatura não encontrada neste workspace.",
        404,
      );
    }

    const targetEmail =
      to ||
      recipientEmail ||
      (invoice.client.contact && invoice.client.contact.includes("@")
        ? invoice.client.contact
        : null) ||
      "hugovictorgutierrez@gmail.com";

    const htmlDocument = buildInvoiceHtml({
      invoiceId: invoice.id,
      tenantName: invoice.tenant?.name || "TrackFlow Workspace",
      clientName: invoice.client.name,
      monthRef: invoice.monthRef,
      durationSeconds: invoice.durationSeconds,
      amountCents: invoice.amountCents,
      status: invoice.status,
      aiSummary: invoice.aiSummary,
    });

    const resend = createResendClient();

    const emailResponse = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: targetEmail,
      subject:
        subject ||
        `Fatura TrackFlow (${invoice.monthRef}) - ${invoice.client.name}`,
      html: htmlDocument,
    });

    if (emailResponse.error) {
      throw new AppError(
        "EMAIL_SEND_FAILED",
        emailResponse.error.message || "Falha ao disparar o e-mail via Resend.",
        400,
        emailResponse.error,
      );
    }

    return res.json({
      success: true,
      data: {
        message: "Fatura enviada por e-mail com sucesso.",
        to: targetEmail,
        resendId: emailResponse.data?.id || null,
        invoice,
      },
    });
  }

  static async updateStatus(
    req: Request<{ id: string }, {}, { status: InvoiceStatus }>,
    res: Response,
  ) {
    const tenantId = req.user!.tenantId as string;
    const { id } = req.params;
    const { status } = req.body || {};

    const validStatuses: InvoiceStatus[] = [
      InvoiceStatus.pendente,
      InvoiceStatus.pago,
      InvoiceStatus.cancelado,
    ];

    if (!status || !validStatuses.includes(status)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Status inválido. Valores permitidos: 'pendente', 'pago' ou 'cancelado'.",
        400,
      );
    }

    const existing = await InvoiceModel.findById(id, tenantId);
    if (!existing) {
      throw new AppError("INVOICE_NOT_FOUND", "Fatura não encontrada.", 404);
    }

    const paidAt = status === InvoiceStatus.pago ? new Date() : null;
    const updated = await InvoiceModel.updateStatus(id, status, paidAt);

    // [Hardening] Se cancelada, desvincular timeEntries
    if (status === InvoiceStatus.cancelado) {
      await prisma.timeEntry.updateMany({
        where: { invoiceId: id },
        data: { invoiceId: null },
      });
    }

    return res.json({
      success: true,
      data: updated,
    });
  }

  static async exportCsv(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const { sub: userId, role } = req.user!;
    const { month, clientId, projectId } = req.query;

    const where: any = { tenantId };
    if (role === "MEMBER") where.userId = userId;
    if (clientId) where.project = { clientId };
    if (projectId) where.projectId = projectId;

    const entries = await prisma.timeEntry.findMany({
      where,
      include: { project: { include: { client: true } }, user: true },
      orderBy: { start: "desc" },
    });

    const isMember = role === "MEMBER";
    const header = isMember
      ? "Data;Projeto;Atividade;Duração (HH:MM:SS);Faturável"
      : "Data;Cliente;Projeto;Colaborador;Atividade;Duração (HH:MM:SS);Faturável;Taxa Hora (R$);Valor Total (R$);Status Fatura";

    const rows = entries.map((e) => {
      const dur = formatDurationHMS(e.durationSeconds || 0);
      const rate = (e.hourlyRateCents || 0) / 100;
      const total = (e.amountCents || 0) / 100;

      const base = [
        new Date(e.start).toLocaleDateString("pt-BR"),
        ...(isMember ? [] : [e.project?.client?.name || "-"]),
        e.project?.name || "-",
        ...(isMember ? [] : [e.user?.name || "-"]),
        e.description || "-",
        dur,
        e.billable ? "Sim" : "Não",
        ...(isMember ? [] : [rate.toFixed(2), total.toFixed(2), "Pendente"]),
      ];
      return base.join(";");
    });

    const csvContent = "\uFEFF" + [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=relatorio.csv");
    return res.send(csvContent);
  }

  static async listInvoices(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const clientId =
      typeof req.query.clientId === "string" ? req.query.clientId : undefined;
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as InvoiceStatus)
        : undefined;

    const invoices = await InvoiceModel.listByTenant(tenantId, {
      clientId,
      status,
    });

    return res.json({
      success: true,
      data: invoices,
    });
  }

  static async generatePdf(req: Request<{ id: string }>, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const { id } = req.params;

    const invoice = await InvoiceModel.findById(id, tenantId);
    if (!invoice) {
      throw new AppError("INVOICE_NOT_FOUND", "Fatura não encontrada.", 404);
    }

    const { generateInvoicePdf } = await import("../services/pdf.service.js");

    const pdfBuffer = await generateInvoicePdf({
      tenantName: invoice.tenant?.name || "TrackFlow",
      clientName: invoice.client.name,
      monthRef: invoice.monthRef,
      durationSeconds: invoice.durationSeconds,
      amountCents: invoice.amountCents,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fatura-${invoice.id}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  }
}
