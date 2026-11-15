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
): ProjectStatus {
  if (currentStatus === ProjectStatus.COMPLETED) {
    return ProjectStatus.COMPLETED;
  }
  if (estimatedSeconds && estimatedSeconds > 0 && totalSecondsSpent >= estimatedSeconds) {
    return ProjectStatus.OVER_BUDGET;
  }
  return ProjectStatus.ACTIVE;
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
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        timeEntries: {
          where: { end: { not: null } },
          select: {
            durationSeconds: true,
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
      let totalSecondsSpent = 0;
      let accumulatedCostCents = 0;

      for (const entry of project.timeEntries) {
        const secs = entry.durationSeconds || 0;
        const rateCents = entry.user?.settings?.hourlyRateCents ?? 0;
        totalSecondsSpent += secs;
        accumulatedCostCents += calculateAmountCents(secs, rateCents);
      }

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
          select: { durationSeconds: true },
        },
      },
    });

    if (!project || project.status === ProjectStatus.COMPLETED) {
      return;
    }

    const totalSecondsSpent = project.timeEntries.reduce(
      (sum, entry) => sum + (entry.durationSeconds || 0),
      0,
    );

    const effectiveStatus = computeOverBudgetStatus(
      project.status,
      project.estimatedSeconds,
      totalSecondsSpent,
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
      where: { id, tenantId },
      include: {
        timeEntries: {
          where: { end: { not: null } },
          select: { durationSeconds: true },
        },
      },
    });

    if (!project) {
      return null;
    }

    let nextStatus: ProjectStatus = ProjectStatus.COMPLETED;
    if (status === "ACTIVE") {
      const totalSecondsSpent = project.timeEntries.reduce(
        (sum, entry) => sum + (entry.durationSeconds || 0),
        0,
      );
      nextStatus = computeOverBudgetStatus(
        ProjectStatus.ACTIVE,
        project.estimatedSeconds,
        totalSecondsSpent,
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

  static async deleteProject(data: DeleteProjectInput) {
    return prisma.project.deleteMany({
      where: { id: data.id, tenantId: data.tenantId },
    });
  }
}
