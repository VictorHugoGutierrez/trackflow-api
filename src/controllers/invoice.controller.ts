import { Request, Response } from "express";
import { InvoiceStatus } from "@prisma/client";
import React from "react";
import { InvoiceModel } from "../models/invoice.model.js";
import { prisma } from "../lib/prisma.js";
import { runOllamaChat } from "../lib/ollama.js";
import { AppError } from "../errors/app-error.js";
import {
  buildInvoiceEmailHtml,
  sendInvoiceEmail,
} from "../services/email.service.js";
import {
  calculateAmountCents,
  formatCurrencyBRL,
  formatDurationHMS,
  formatDurationHuman,
  parseReaisToCents,
} from "../utils/formatters.js";


function getMonthDateRangeBRT(
  monthStr?: string,
): { startDate: Date; endDate: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec((monthStr || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  const dd = String(lastDay).padStart(2, "0");
  return {
    startDate: new Date(`${year}-${mm}-01T00:00:00.000-03:00`),
    endDate: new Date(`${year}-${mm}-${dd}T23:59:59.999-03:00`),
  };
}

function sanitizeCsvField(val: string): string {
  return val.replace(/[\r\n;]+/g, " ").trim();
}

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

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId },
      });
      if (!project) {
        throw new AppError(
          "PROJECT_NOT_FOUND",
          "Projeto não encontrado neste workspace.",
          404,
        );
      }
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

    const aiSummaryText = await runOllamaChat([
      { role: "user", content: finalPrompt },
    ]);

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

    const monthRange =
      !startDate && !endDate ? getMonthDateRangeBRT(monthRef) : null;
    const rangeStart = startDate
      ? new Date(startDate)
      : monthRange?.startDate;
    const rangeEnd = endDate
      ? new Date(endDate)
      : monthRange?.endDate;

    if (finalDurationSeconds === undefined || finalAmountCents === undefined) {
      const summary = await InvoiceModel.getReportSummary({
        tenantId,
        userId,
        clientId,
        startDate: rangeStart && !isNaN(rangeStart.getTime()) ? rangeStart : undefined,
        endDate: rangeEnd && !isNaN(rangeEnd.getTime()) ? rangeEnd : undefined,
        hourlyRateCents: requestedRateCents,
        onlyUnbilled: true,
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
        finalAiSummary = await runOllamaChat([
          {
            role: "user",
            content: `Gere um resumo executivo curto em português (2 parágrafos) para a fatura do cliente "${client.name}" referente a ${monthRef}, totalizando ${formatDurationHuman(finalDurationSeconds)} trabalhadas e ${formatCurrencyBRL(finalAmountCents)}.`,
          },
        ]);
      } catch (err: any) {
        console.warn(
          "Falha ao gerar resumo IA durante emissão de fatura (usando contingência):",
          err?.message || err,
        );
        finalAiSummary = `Serviços prestados ao cliente ${client.name} durante ${monthRef}, totalizando ${formatDurationHuman(finalDurationSeconds)} apuradas.`;
      }
    }

    const htmlDocument = buildInvoiceEmailHtml({
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

    const timeEntryStartFilter: { gte?: Date; lte?: Date } = {};
    if (rangeStart && !isNaN(rangeStart.getTime())) {
      timeEntryStartFilter.gte = rangeStart;
    }
    if (rangeEnd && !isNaN(rangeEnd.getTime())) {
      timeEntryStartFilter.lte = rangeEnd;
    }

    await prisma.timeEntry.updateMany({
      where: {
        tenantId,
        billable: true,
        invoiceId: null,
        end: { not: null },
        project: { clientId },
        ...(Object.keys(timeEntryStartFilter).length > 0
          ? { start: timeEntryStartFilter }
          : {}),
      },
      data: {
        invoiceId: invoice.id,
      },
    });

    let emailResult: any = null;
    if (sendEmail) {
      const targetEmail =
        recipientEmail ||
        (client.contact && client.contact.includes("@") ? client.contact : null) ||
        "hugovictorgutierrez@gmail.com";

      emailResult = await sendInvoiceEmail({
        invoiceId: invoice.id,
        to: targetEmail,
        subject: `Fatura TrackFlow - ${monthRef} - ${client.name}`,
        tenantName: tenant?.name || "TrackFlow Workspace",
        clientName: client.name,
        monthRef,
        durationSeconds: finalDurationSeconds,
        amountCents: finalAmountCents,
        status: "pendente",
        aiSummary: finalAiSummary,
        throwOnError: false,
      });
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

    const emailResult = await sendInvoiceEmail({
      invoiceId: invoice.id,
      to: targetEmail,
      subject,
      tenantName: invoice.tenant?.name || "TrackFlow Workspace",
      clientName: invoice.client.name,
      monthRef: invoice.monthRef,
      durationSeconds: invoice.durationSeconds,
      amountCents: invoice.amountCents,
      status: invoice.status,
      aiSummary: invoice.aiSummary,
      throwOnError: true,
    });

    return res.json({
      success: true,
      data: {
        message: "Fatura enviada por e-mail com sucesso.",
        to: targetEmail,
        resendId: emailResult.resendId,
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
    const { month, clientId, projectId, startDate, endDate } = req.query;

    const where: any = {
      tenantId,
      end: { not: null },
    };
    if (role === "MEMBER") where.userId = userId;
    if (typeof clientId === "string" && clientId) where.project = { clientId };
    if (typeof projectId === "string" && projectId) where.projectId = projectId;

    const parsedStart =
      typeof startDate === "string" && startDate ? new Date(startDate) : undefined;
    const parsedEnd =
      typeof endDate === "string" && endDate ? new Date(endDate) : undefined;

    if (
      (parsedStart && !isNaN(parsedStart.getTime())) ||
      (parsedEnd && !isNaN(parsedEnd.getTime()))
    ) {
      where.start = {};
      if (parsedStart && !isNaN(parsedStart.getTime())) where.start.gte = parsedStart;
      if (parsedEnd && !isNaN(parsedEnd.getTime())) where.start.lte = parsedEnd;
    } else if (typeof month === "string" && month) {
      const monthRange = getMonthDateRangeBRT(month);
      if (monthRange) {
        where.start = {
          gte: monthRange.startDate,
          lte: monthRange.endDate,
        };
      }
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: { include: { client: true } },
        user: true,
        invoice: { select: { status: true } },
      },
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
      const invoiceStatusLabel = e.invoice
        ? e.invoice.status === "pago"
          ? "Pago"
          : e.invoice.status === "cancelado"
            ? "Cancelado"
            : "Pendente"
        : e.billable
          ? "Não faturado"
          : "Não faturável";

      const base = [
        new Date(e.start).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        ...(isMember
          ? []
          : [sanitizeCsvField(e.project?.client?.name || "-")]),
        sanitizeCsvField(e.project?.name || "-"),
        ...(isMember ? [] : [sanitizeCsvField(e.user?.name || "-")]),
        sanitizeCsvField(e.description || "-"),
        dur,
        e.billable ? "Sim" : "Não",
        ...(isMember
          ? []
          : [rate.toFixed(2), total.toFixed(2), invoiceStatusLabel]),
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
      status: invoice.status,
      aiSummary: invoice.aiSummary,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fatura-${invoice.id}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  }
}
