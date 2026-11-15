import { prisma } from "../lib/prisma.js";
import { InvoiceStatus } from "@prisma/client";
import {
  calculateAmountCents,
  formatCurrencyBRL,
  formatDurationHMS,
} from "../utils/formatters.js";

export interface CreateInvoiceInput {
  tenantId: string;
  clientId: string;
  monthRef: string;
  durationSeconds: number;
  amountCents: number;
  status?: InvoiceStatus;
  aiSummary?: string;
  pdfUrl?: string;
}

export interface ReportSummaryFilters {
  tenantId: string;
  clientId?: string;
  projectId?: string;
  startDate?: Date;
  endDate?: Date;
  hourlyRateCents?: number;
  userId?: string;
}

export class InvoiceModel {
  static async getReportSummary(filters: ReportSummaryFilters) {
    const { tenantId, clientId, projectId, startDate, endDate, userId } = filters;

    let defaultHourlyRateCents = filters.hourlyRateCents;
    let currency = "BRL";

    if (userId) {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });
      if (settings) {
        if (defaultHourlyRateCents === undefined) {
          defaultHourlyRateCents = settings.hourlyRateCents;
        }
        currency = settings.currency || "BRL";
      }
    }

    const rateCents = defaultHourlyRateCents ?? 0;
    const rateDecimal = Number((rateCents / 100).toFixed(2));

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
      if (startDate) where.start.gte = startDate;
      if (endDate) where.start.lte = endDate;
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: {
          include: {
            client: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { start: "desc" },
    });

    const projectMap = new Map<
      string,
      {
        projectId: string | null;
        projectName: string;
        clientId: string | null;
        clientName: string;
        budgetCents: number | null;
        estimatedSeconds: number | null;
        totalSeconds: number;
        billableSeconds: number;
        amountCents: number;
        entriesCount: number;
        entries: typeof timeEntries;
      }
    >();

    for (const entry of timeEntries) {
      const key = entry.projectId || "unassigned";
      const existing = projectMap.get(key);
      const duration = entry.durationSeconds || 0;
      const billableDuration = entry.billable ? duration : 0;
      const entryAmountCents = entry.billable
        ? entry.amountCents > 0
          ? entry.amountCents
          : calculateAmountCents(billableDuration, rateCents)
        : 0;

      if (!existing) {
        projectMap.set(key, {
          projectId: entry.projectId,
          projectName: entry.project?.name || "Sem Projeto",
          clientId: entry.project?.clientId || null,
          clientName: entry.project?.client?.name || "Sem Cliente",
          budgetCents: entry.project?.budgetCents ?? null,
          estimatedSeconds: entry.project?.estimatedSeconds ?? null,
          totalSeconds: duration,
          billableSeconds: billableDuration,
          amountCents: entryAmountCents,
          entriesCount: 1,
          entries: [entry],
        });
      } else {
        existing.totalSeconds += duration;
        existing.billableSeconds += billableDuration;
        existing.amountCents += entryAmountCents;
        existing.entriesCount += 1;
        existing.entries.push(entry);
      }
    }

    const projects = Array.from(projectMap.values()).map((group) => {
      const totalHours = Number((group.totalSeconds / 3600).toFixed(2));
      const billableHours = Number((group.billableSeconds / 3600).toFixed(2));
      const totalValue = Number((group.amountCents / 100).toFixed(2));
      const budgetHours =
        group.estimatedSeconds !== null
          ? Number((group.estimatedSeconds / 3600).toFixed(2))
          : null;

      return {
        projectId: group.projectId,
        projectName: group.projectName,
        clientId: group.clientId,
        clientName: group.clientName,
        budgetCents: group.budgetCents,
        estimatedSeconds: group.estimatedSeconds,
        budgetHours,
        totalSeconds: group.totalSeconds,
        billableSeconds: group.billableSeconds,
        formattedDuration: formatDurationHMS(group.totalSeconds),
        totalHours,
        billableHours,
        hourlyRateCents: rateCents,
        hourlyRate: rateDecimal,
        amountCents: group.amountCents,
        totalValue,
        formattedAmount: formatCurrencyBRL(group.amountCents),
        entriesCount: group.entriesCount,
        entries: group.entries,
      };
    });

    const totalSecondsGlobal = projects.reduce((acc, p) => acc + p.totalSeconds, 0);
    const billableSecondsGlobal = projects.reduce(
      (acc, p) => acc + p.billableSeconds,
      0,
    );
    const amountCentsGlobal = projects.reduce((acc, p) => acc + p.amountCents, 0);
    const totalHoursGlobal = Number((totalSecondsGlobal / 3600).toFixed(2));
    const billableHoursGlobal = Number((billableSecondsGlobal / 3600).toFixed(2));
    const totalValueGlobal = Number((amountCentsGlobal / 100).toFixed(2));

    return {
      durationSeconds: totalSecondsGlobal,
      billableSeconds: billableSecondsGlobal,
      formattedDuration: formatDurationHMS(totalSecondsGlobal),
      totalHours: totalHoursGlobal,
      billableHours: billableHoursGlobal,
      amountCents: amountCentsGlobal,
      totalValue: totalValueGlobal,
      formattedAmount: formatCurrencyBRL(amountCentsGlobal),
      hourlyRateCents: rateCents,
      hourlyRate: rateDecimal,
      currency,
      entriesCount: timeEntries.length,
      projects,
    };
  }

  static async listByTenant(
    tenantId: string,
    filters: { clientId?: string; status?: InvoiceStatus } = {},
  ) {
    const where: any = { tenantId };
    if (filters.clientId) {
      where.clientId = filters.clientId;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    return prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
      },
    });
  }

  static async findById(id: string, tenantId: string) {
    return prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        client: true,
        tenant: true,
      },
    });
  }

  static async create(data: CreateInvoiceInput) {
    return prisma.invoice.create({
      data: {
        tenantId: data.tenantId,
        clientId: data.clientId,
        monthRef: data.monthRef,
        durationSeconds: data.durationSeconds,
        amountCents: data.amountCents,
        status: data.status || InvoiceStatus.pendente,
        aiSummary: data.aiSummary || null,
        pdfUrl: data.pdfUrl || null,
      },
      include: {
        client: true,
      },
    });
  }

  static async updateStatus(
    id: string,
    status: InvoiceStatus,
    paidAt?: Date | null,
  ) {
    return prisma.invoice.update({
      where: { id },
      data: {
        status,
        paidAt: paidAt !== undefined ? paidAt : undefined,
      },
      include: {
        client: true,
      },
    });
  }
}
