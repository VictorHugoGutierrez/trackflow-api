import { ProjectStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { calculateAmountCents } from "../utils/formatters.js";

interface CreateProjectInput {
  tenantId: string;
  name: string;
  budgetCents?: number | null;
  estimatedSeconds?: number | null;
  status?: ProjectStatus;
  clientId?: string | null;
}

interface AlterProjectInput {
  tenantId: string;
  id: string;
  name?: string;
  budgetCents?: number | null;
  estimatedSeconds?: number | null;
  status?: ProjectStatus;
  clientId?: string | null;
}

interface DeleteProjectInput {
  tenantId: string;
  id: string;
}

function computeOverBudgetStatus(
  currentStatus: ProjectStatus,
  estimatedSeconds: number | null,
  totalSecondsSpent: number,
  budgetCents: number | null,
  accumulatedCostCents: number,
): ProjectStatus {
  if (currentStatus === ProjectStatus.COMPLETED) {
    return ProjectStatus.COMPLETED;
  }
  const overHours = Boolean(
    estimatedSeconds && estimatedSeconds > 0 && totalSecondsSpent >= estimatedSeconds,
  );
  const overBudget = Boolean(
    budgetCents && budgetCents > 0 && accumulatedCostCents >= budgetCents,
  );
  if (overHours || overBudget) {
    return ProjectStatus.OVER_BUDGET;
  }
  return ProjectStatus.ACTIVE;
}

function calculateProjectTotals(
  entries: Array<{
    durationSeconds: number | null;
    billable: boolean;
    amountCents: number;
    user?: { settings?: { hourlyRateCents: number } | null } | null;
  }>,
) {
  let totalSecondsSpent = 0;
  let accumulatedCostCents = 0;

  for (const entry of entries) {
    const secs = entry.durationSeconds || 0;
    totalSecondsSpent += secs;
    if (entry.billable) {
      const rateCents = entry.user?.settings?.hourlyRateCents ?? 0;
      accumulatedCostCents +=
        entry.amountCents > 0
          ? entry.amountCents
          : calculateAmountCents(secs, rateCents);
    }
  }

  return { totalSecondsSpent, accumulatedCostCents };
}

export class ProjectModel {
  static async createProject(data: CreateProjectInput) {
    return prisma.project.create({
      data: {
        tenantId: data.tenantId,
        name: data.name.trim(),
        clientId: data.clientId || null,
        budgetCents: data.budgetCents ?? null,
        estimatedSeconds: data.estimatedSeconds ?? null,
        status: data.status || ProjectStatus.ACTIVE,
      },
      include: {
        client: true,
      },
    });
  }

  static async findAllByTenant(tenantId: string) {
    const projects = await prisma.project.findMany({
      where: { tenantId, active: true },
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        timeEntries: {
          where: { end: { not: null } },
          select: {
            durationSeconds: true,
            billable: true,
            amountCents: true,
            user: {
              select: {
                settings: {
                  select: {
                    hourlyRateCents: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const statusUpdates: Promise<unknown>[] = [];

    const enriched = projects.map((project) => {
      const { totalSecondsSpent, accumulatedCostCents } = calculateProjectTotals(
        project.timeEntries,
      );

      let progressPercent = 0;
      if (project.estimatedSeconds && project.estimatedSeconds > 0) {
        progressPercent = Math.round((totalSecondsSpent / project.estimatedSeconds) * 100);
      } else if (project.budgetCents && project.budgetCents > 0) {
        progressPercent = Math.round((accumulatedCostCents / project.budgetCents) * 100);
      }

      const effectiveStatus = computeOverBudgetStatus(
        project.status,
        project.estimatedSeconds,
        totalSecondsSpent,
        project.budgetCents,
        accumulatedCostCents,
      );

      if (effectiveStatus !== project.status) {
        statusUpdates.push(
          prisma.project.update({
            where: { id: project.id },
            data: { status: effectiveStatus },
          }),
        );
      }

      const { timeEntries: _entries, ...projectData } = project;
      return {
        ...projectData,
        status: effectiveStatus,
        totalSecondsSpent,
        accumulatedCostCents,
        progressPercent,
      };
    });

    if (statusUpdates.length > 0) {
      await Promise.all(statusUpdates);
    }

    return enriched;
  }

  static async syncHealthStatus(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        timeEntries: {
          where: { end: { not: null } },
          select: {
            durationSeconds: true,
            billable: true,
            amountCents: true,
            user: {
              select: {
                settings: {
                  select: {
                    hourlyRateCents: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project || project.status === ProjectStatus.COMPLETED) {
      return;
    }

    const { totalSecondsSpent, accumulatedCostCents } = calculateProjectTotals(
      project.timeEntries,
    );

    const effectiveStatus = computeOverBudgetStatus(
      project.status,
      project.estimatedSeconds,
      totalSecondsSpent,
      project.budgetCents,
      accumulatedCostCents,
    );

    if (effectiveStatus !== project.status) {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: effectiveStatus },
      });
    }
  }

  static async alterProject(data: AlterProjectInput) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.budgetCents !== undefined) updateData.budgetCents = data.budgetCents;
    if (data.estimatedSeconds !== undefined) updateData.estimatedSeconds = data.estimatedSeconds;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.clientId !== undefined) updateData.clientId = data.clientId;

    const result = await prisma.project.updateMany({
      where: { id: data.id, tenantId: data.tenantId },
      data: updateData,
    });

    if (result.count > 0) {
      await ProjectModel.syncHealthStatus(data.id);
    }

    return result;
  }

  static async updateStatus(
    tenantId: string,
    id: string,
    status: "ACTIVE" | "COMPLETED",
  ) {
    const project = await prisma.project.findFirst({
      where: { id, tenantId, active: true },
      include: {
        timeEntries: {
          where: { end: { not: null } },
          select: {
            durationSeconds: true,
            billable: true,
            amountCents: true,
            user: {
              select: {
                settings: {
                  select: {
                    hourlyRateCents: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return null;
    }

    let nextStatus: ProjectStatus = ProjectStatus.COMPLETED;
    if (status === "ACTIVE") {
      const { totalSecondsSpent, accumulatedCostCents } = calculateProjectTotals(
        project.timeEntries,
      );
      nextStatus = computeOverBudgetStatus(
        ProjectStatus.ACTIVE,
        project.estimatedSeconds,
        totalSecondsSpent,
        project.budgetCents,
        accumulatedCostCents,
      );
    }

    return prisma.project.update({
      where: { id: project.id },
      data: { status: nextStatus },
      include: {
        client: true,
      },
    });
  }

  static async deactivateProject(data: DeleteProjectInput) {
    const project = await prisma.project.findFirst({
        where: { id: data.id, tenantId: data.tenantId },
        include: { timeEntries: true }
    });

    if (!project) return { count: 0 };

    if (project.timeEntries.length > 0) {
        return prisma.project.updateMany({
            where: { id: data.id, tenantId: data.tenantId },
            data: { active: false }
        });
    }
    return prisma.project.deleteMany({
        where: { id: data.id, tenantId: data.tenantId }
    });
  }
}
