import { Request, Response } from "express";
import ollama from "ollama";
import { Resend } from "resend";
import { InvoiceStatus } from "@prisma/client";
import { InvoiceModel } from "../models/invoice.model.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../errors/app-error.js";
import {
  formatCurrencyBRL,
  formatDurationHMS,
  formatDurationHuman,
  parseReaisToCents,
} from "../utils/formatters.js";

interface GenerateSummaryBody {
  clientId: string;
  monthRef?: string;
  startDate?: string;
  endDate?: string;
}

interface CreateInvoiceBody {
  clientId: string;
  monthRef: string;
  durationSeconds?: number;
  amountCents?: number;
  totalHours?: number;
  totalValue?: number;
  aiSummary?: string;
  sendEmail?: boolean;
  recipientEmail?: string;
}

export class InvoiceController {
  static async listInvoices(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
    const status = typeof req.query.status === "string" ? (req.query.status as InvoiceStatus) : undefined;

    const invoices = await InvoiceModel.listByTenant(tenantId, { clientId, status });

    return res.json({
      success: true,
      data: invoices,
    });
  }

  static async generateAiSummary(
    req: Request<{}, {}, GenerateSummaryBody>,
    res: Response,
  ) {
    const tenantId = req.user!.tenantId as string;
    const { clientId, monthRef, startDate, endDate } = req.body;

    if (!clientId) {
      throw new AppError("VALIDATION_ERROR", "O campo 'clientId' é obrigatório.", 400);
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    if (!client) {
      throw new AppError("CLIENT_NOT_FOUND", "Cliente não encontrado neste workspace.", 404);
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        project: {
          clientId,
        },
        end: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { start: dateFilter } : {}),
      },
      include: {
        project: true,
      },
      orderBy: { start: "asc" },
    });

    const totalDurationSeconds = timeEntries.reduce(
      (acc, entry) => acc + (entry.durationSeconds || 0),
      0,
    );
    const formattedDuration = formatDurationHMS(totalDurationSeconds);
    const humanDuration = formatDurationHuman(totalDurationSeconds);

    const descriptions = timeEntries
      .map(
        (entry) =>
          `- [${entry.project?.name || "Geral"}] ${entry.description || "Sem descrição"} (${formatDurationHuman(entry.durationSeconds)})`,
      )
      .slice(0, 30)
      .join("\n");

    const prompt = `Você é um assistente financeiro e de gestão do TrackFlow.
Gere um resumo executivo profissional, claro e conciso em língua portuguesa para a fatura do cliente "${client.name}".
Mês/Período de Referência: ${monthRef || "Recente"}
Tempo Total Trabalhado: ${humanDuration} (${formattedDuration}).
Entregas e Atividades Realizadas:
${descriptions || "Diversas atividades e reuniões de projeto."}

Formate com 2 a 3 parágrafos curtos destacando o valor entregue, os projetos atendidos e o total de tempo apurado.`;

    let summaryText = "";

    try {
      const ollamaModel = process.env.OLLAMA_API_MODEL || "gemma4";
      const response = await ollama.chat({
        model: ollamaModel,
        messages: [{ role: "user", content: prompt }],
      });
      summaryText = response.message?.content?.trim() || "";
    } catch {
      summaryText = `Resumo de Prestação de Serviços - ${client.name}\n\nDurante o período apurado (${monthRef || "mensal"}), foram dedicadas ${humanDuration} (${formattedDuration}) de desenvolvimento e consultoria especializada em projetos vinculados ao cliente. Todas as atividades foram validadas no sistema de apontamento de horas com foco em eficiência e qualidade nas entregas.`;
    }

    return res.json({
      success: true,
      data: {
        clientId: client.id,
        clientName: client.name,
        monthRef: monthRef || "",
        durationSeconds: totalDurationSeconds,
        formattedDuration,
        totalEntries: timeEntries.length,
        summary: summaryText,
      },
    });
  }

  static async createInvoice(
    req: Request<{}, {}, CreateInvoiceBody>,
    res: Response,
  ) {
    const tenantId = req.user!.tenantId as string;
    const {
      clientId,
      monthRef,
      durationSeconds: rawDurationSeconds,
      amountCents: rawAmountCents,
      totalHours,
      totalValue,
      aiSummary,
      sendEmail,
      recipientEmail,
    } = req.body;

    const durationSeconds =
      rawDurationSeconds !== undefined
        ? Math.max(0, Math.round(Number(rawDurationSeconds)))
        : totalHours !== undefined
          ? Math.max(0, Math.round(Number(totalHours) * 3600))
          : undefined;

    const amountCents =
      rawAmountCents !== undefined
        ? Math.max(0, Math.round(Number(rawAmountCents)))
        : totalValue !== undefined
          ? parseReaisToCents(totalValue)
          : undefined;

    if (
      !clientId ||
      !monthRef ||
      durationSeconds === undefined ||
      amountCents === undefined ||
      !Number.isFinite(durationSeconds) ||
      !Number.isFinite(amountCents)
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Os campos 'clientId', 'monthRef', 'durationSeconds' e 'amountCents' são obrigatórios.",
        400,
      );
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    if (!client) {
      throw new AppError("CLIENT_NOT_FOUND", "Cliente não encontrado neste workspace.", 404);
    }

    const invoice = await InvoiceModel.create({
      tenantId,
      clientId,
      monthRef,
      durationSeconds,
      amountCents,
      aiSummary,
    });

    let emailStatus: "sent" | "not_requested" | "failed" | "not_configured" = "not_requested";
    let emailDetails: any = null;

    if (sendEmail) {
      const targetEmail = recipientEmail || client.contact;
      const resendApiKey = process.env.RESEND_API_KEY;

      if (!targetEmail || !targetEmail.includes("@")) {
        emailStatus = "failed";
        emailDetails = { reason: "E-mail de destinatário inválido ou não informado." };
      } else if (!resendApiKey || resendApiKey.startsWith("re_123456789")) {
        emailStatus = "not_configured";
        emailDetails = { reason: "Chave do Resend não configurada em produção." };
      } else {
        try {
          const resend = new Resend(resendApiKey);
          const emailResponse = await resend.emails.send({
            from: "TrackFlow <faturas@trackflow.com>",
            to: targetEmail,
            subject: `Fatura TrackFlow - ${monthRef} - ${client.name}`,
            html: `<h2>Fatura de Serviços - TrackFlow</h2>
<p>Prezado(a) ${client.name},</p>
<p>Segue a fatura de serviços referente a <strong>${monthRef}</strong>.</p>
<p><strong>Tempo Apurado:</strong> ${formatDurationHMS(invoice.durationSeconds)}<br/>
<strong>Valor Total:</strong> ${formatCurrencyBRL(invoice.amountCents)}</p>
${aiSummary ? `<h3>Resumo das Atividades</h3><p>${aiSummary.replace(/\n/g, "<br/>")}</p>` : ""}
<p>Agradecemos a parceria!</p>`,
          });
          emailStatus = "sent";
          emailDetails = emailResponse;
        } catch (err: any) {
          emailStatus = "failed";
          emailDetails = { message: err?.message || "Falha ao enviar e-mail via Resend" };
        }
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        invoice,
        email: {
          status: emailStatus,
          details: emailDetails,
        },
      },
    });
  }

  static async updateStatus(
    req: Request<{ id: string }, {}, { status: InvoiceStatus }>,
    res: Response,
  ) {
    const tenantId = req.user!.tenantId as string;
    const { id } = req.params;
    const { status } = req.body;

    const existing = await InvoiceModel.findById(id, tenantId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Fatura não encontrada.", 404);
    }

    const paidAt = status === InvoiceStatus.pago ? new Date() : undefined;
    const updated = await InvoiceModel.updateStatus(id, tenantId, status, paidAt);

    return res.json({
      success: true,
      data: updated,
    });
  }
}
