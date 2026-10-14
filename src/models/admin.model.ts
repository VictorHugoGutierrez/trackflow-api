import { prisma } from "../lib/prisma.js";

interface UpdateTenantInput {
  name?: string;
  plan?: string;
  active?: boolean;
}

export class AdminModel {
  // Retorna métricas globais do SaaS (Qtd tenants, faturamento aproximado/MRR, uso geral)
  static async getMetrics() {
    const [totalTenants, activeTenants, totalUsers, totalTimeEntries] =
      await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { active: true } }),
        prisma.user.count(),
        prisma.timeEntry.count(),
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

    return {
      overview: {
        totalTenants,
        activeTenants,
        suspendedTenants: totalTenants - activeTenants,
        totalUsers,
        totalTimeEntries,
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

  // Lista todas as empresas cadastradas com quantidade de membros
  static async listTenants() {
    return prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            users: true,
            projects: true,
            clients: true,
            timeEntries: true,
          },
        },
      },
    });
  }

  // Bloqueia/desbloqueia ou altera o plano do tenant
  static async updateTenant(id: string, data: UpdateTenantInput) {
    return prisma.tenant.update({
      where: { id },
      data,
    });
  }
}
