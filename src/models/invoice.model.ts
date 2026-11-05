import { prisma } from "../lib/prisma.js";
import { InvoiceStatus } from "@prisma/client";

export interface CreateInvoiceInput {
  tenantId: string;
  clientId: string;
  monthRef: string;
  totalHours: number;
  totalValue: number;
  status?: InvoiceStatus;
  aiSummary?: string;
  pdfUrl?: string;
}

export class InvoiceModel {
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
      },
    });
  }

  static async create(data: CreateInvoiceInput) {
    return prisma.invoice.create({
      data: {
        tenantId: data.tenantId,
        clientId: data.clientId,
        monthRef: data.monthRef,
        totalHours: data.totalHours,
        totalValue: data.totalValue,
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
    tenantId: string,
    status: InvoiceStatus,
    paidAt?: Date,
  ) {
    return prisma.invoice.update({
      where: { id },
      data: {
        status,
        ...(paidAt ? { paidAt } : {}),
      },
      include: {
        client: true,
      },
    });
  }
}
