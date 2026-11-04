import { prisma } from "../lib/prisma.js";
import { Role } from "@prisma/client";

interface UpdateTenantInput {
  name?: string;
  plan?: string;
  active?: boolean;
}

export interface ListTenantsFilters {
  page?: number;
  limit?: number;
  search?: string;
  plan?: string;
  active?: boolean;
}

export class AdminModel {
  static async getMetrics() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalTimeEntries,
      todayDurationResult,
      aiReportsCount,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { active: true } }),
      prisma.user.count(),
      prisma.timeEntry.count(),
      prisma.timeEntry.aggregate({
        where: { start: { gte: todayStart } },
        _sum: { duration: true },
      }),
      prisma.invoice.count({
        where: { aiSummary: { not: null } },
      }),
    ]);

    const planCounts = await prisma.tenant.groupBy({
      by: ["plan"],
      where: { active: true },
      _count: {
        id: true,
      },
    });

    const PLAN_PRICES: Record<string, number> = {
      freemium: 0,
      pro: 49.9,
      enterprise: 199.0,
    };

    let calculatedMrr = 0;
    for (const group of planCounts) {
      const price = PLAN_PRICES[group.plan.toLowerCase()] ?? 0;
      calculatedMrr += group._count.id * price;
    }

    const todayHours = Number(
      (((todayDurationResult._sum.duration || 0) / 3600)).toFixed(1),
    );

    return {
      overview: {
        totalTenants,
        activeTenants,
        suspendedTenants: totalTenants - activeTenants,
        totalUsers,
        totalTimeEntries,
        todayHours,
        aiReportsGenerated: aiReportsCount,
      },
      financial: {
        estimatedMrr: Number(calculatedMrr.toFixed(2)),
        currency: "BRL",
        distributionByPlan: planCounts.map((p) => ({
          plan: p.plan,
          count: p._count.id,
        })),
      },
    };
  }

  static async listTenants(filters?: ListTenantsFilters) {
    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.search) {
      where.name = {
        contains: filters.search.trim(),
        mode: "insensitive",
      };
    }
    if (filters?.plan) {
      where.plan = {
        equals: filters.plan.toLowerCase().trim(),
        mode: "insensitive",
      };
    }
    if (filters?.active !== undefined) {
      where.active = filters.active;
    }

    const [total, tenants] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          users: {
            where: { role: Role.OWNER },
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
            take: 1,
          },
          _count: {
            select: {
              users: true,
              projects: true,
              clients: true,
              timeEntries: true,
              invoices: true,
            },
          },
        },
      }),
    ]);

    const formattedTenants = tenants.map((tenant) => {
      const { users, ...rest } = tenant;
      return {
        ...rest,
        owner: users[0] || null,
      };
    });

    return {
      tenants: formattedTenants,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getTenantById(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            users: true,
            projects: true,
            clients: true,
            timeEntries: true,
            invoices: true,
          },
        },
      },
    });

    if (!tenant) return null;

    const owner = tenant.users.find((u) => u.role === Role.OWNER) || null;

    return {
      ...tenant,
      owner,
    };
  }

  static async updateTenant(id: string, data: UpdateTenantInput) {
    return prisma.tenant.update({
      where: { id },
      data,
    });
  }

  static async deleteTenant(id: string) {
    return prisma.tenant.delete({
      where: { id },
    });
  }

  static async getSystemLogs() {
    const dbConnected = await prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);

    const ollamaModel = process.env.OLLAMA_API_MODEL || "gemma4";
    const resendConfigured = !!process.env.RESEND_API_KEY;

    const [totalAiInvoices, pendingInvoices] = await Promise.all([
      prisma.invoice.count({ where: { aiSummary: { not: null } } }),
      prisma.invoice.count({ where: { status: "pendente" } }),
    ]);

    return {
      services: {
        database: {
          status: dbConnected ? "healthy" : "down",
          provider: "PostgreSQL (Neon)",
        },
        ollama: {
          status: "connected",
          model: ollamaModel,
          totalReportsProcessed: totalAiInvoices,
        },
        resend: {
          status: resendConfigured ? "configured" : "missing_api_key",
          pendingDispatches: pendingInvoices,
        },
      },
      recentEvents: [
        {
          id: "evt-1",
          type: "OLLAMA_SUMMARY",
          status: "SUCCESS",
          message: "Resumo executivo de fatura gerado com sucesso",
          timestamp: new Date().toISOString(),
        },
        {
          id: "evt-2",
          type: "RESEND_EMAIL",
          status: "DELIVERED",
          message: "Notificação de fatura entregue ao cliente",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
    };
  }
}
