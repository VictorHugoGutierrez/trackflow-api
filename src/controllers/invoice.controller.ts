import { Request, Response } from "express";
import ollama from "ollama";
import { Resend } from "resend";
import { InvoiceStatus } from "@prisma/client";
import { InvoiceModel } from "../models/invoice.model.js";
import { ClientModel } from "../models/client.model.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../errors/app-error.js";

interface GenerateSummaryBody {
  clientId: string;
  monthRef?: string;
  startDate?: string;
  endDate?: string;
}

interface CreateInvoiceBody {
  clientId: string;
  monthRef: string;
  totalHours: number;
  totalValue: number;
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
        task: true,
      },
      orderBy: { start: "asc" },
    });

    const totalDurationSeconds = timeEntries.reduce(
      (acc, entry) => acc + (entry.duration || 0),
      0,
    );
    const totalHours = Number((totalDurationSeconds / 3600).toFixed(2));

    const descriptions = timeEntries
      .map((entry) => `- [${entry.project?.name || "Geral"}] ${entry.description || "Sem descrição"} (${entry.duration ? (entry.duration / 3600).toFixed(2) : 0}h)`)
      .slice(0, 30)
      .join("\n");

    const prompt = `Você é um assistente financeiro e de gestão do TrackFlow.
Gere um resumo executivo profissional, claro e conciso em língua portuguesa para a fatura do cliente "${client.name}".
Mês/Período de Referência: ${monthRef || "Recente"}
Total de Horas Trabalhadas: ${totalHours} horas.
Entregas e Atividades Realizadas:
${descriptions || "Diversas atividades e reuniões de projeto."}

Formate com 2 a 3 parágrafos curtos destacando o valor entregue, os projetos atendidos e o total de horas apurado.`;

    let summaryText = "";

    try {
      const ollamaModel = process.env.OLLAMA_API_MODEL || "gemma4";
      const response = await ollama.chat({
        model: ollamaModel,
        messages: [{ role: "user", content: prompt }],
      });
      summaryText = response.message?.content?.trim() || "";
    } catch {
      summaryText = `Resumo de Prestação de Serviços - ${client.name}\n\nDurante o período apurado (${monthRef || "mensal"}), foram dedicadas ${totalHours}h de desenvolvimento e consultoria especializada em projetos vinculados ao cliente. Todas as atividades foram validadas no sistema de apontamento de horas com foco em eficiência e qualidade nas entregas.`;
    }

    return res.json({
      success: true,
      data: {
        clientId: client.id,
        clientName: client.name,
        monthRef: monthRef || "",
        totalHours,
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
    const { clientId, monthRef, totalHours, totalValue, aiSummary, sendEmail, recipientEmail } = req.body;

    if (!clientId || !monthRef || totalHours === undefined || totalValue === undefined) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Os campos 'clientId', 'monthRef', 'totalHours' e 'totalValue' são obrigatórios.",
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
      totalHours,
      totalValue,
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
<p><strong>Total de Horas:</strong> ${totalHours}h<br/>
<strong>Valor Total:</strong> R$ ${Number(totalValue).toFixed(2)}</p>
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
