import { prisma } from "../lib/prisma.js";
import { calculateAmountCents } from "../utils/formatters.js";
import { ProjectModel } from "./project.model.js";

interface StartTimeEntryInput {
  tenantId: string;
  userId: string;
  projectId?: string;
  description?: string;
  billable?: boolean;
}

interface StopTimeEntryInput {
  id: string;
  tenantId: string;
  userId: string;
  description?: string;
  projectId?: string;
  billable?: boolean;
}

interface CreateManualTimeEntryInput {
  tenantId: string;
  userId: string;
  projectId?: string;
  description?: string;
  billable?: boolean;
  start: Date;
  end: Date;
}

interface UpdateTimeEntryInput {
  id: string;
  tenantId: string;
  userId: string;
  description?: string;
  projectId?: string | null;
  billable?: boolean;
  start?: Date;
  end?: Date;
}

interface ListTimeEntriesFilter {
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  projectId?: string;
  clientId?: string;
}

const TIME_ENTRY_INCLUDE = {
  project: {
    include: {
      client: true,
    },
  },
} as const;

async function getUserHourlyRateCents(userId: string): Promise<number> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { hourlyRateCents: true },
  });
  return settings?.hourlyRateCents ?? 0;
}

export class TimeEntryModel {
  static async findActive(tenantId: string, userId: string) {
    return prisma.timeEntry.findFirst({
      where: {
        tenantId,
        userId,
        end: null,
      },
      include: TIME_ENTRY_INCLUDE,
    });
  }

  static async start(data: StartTimeEntryInput) {
    return prisma.timeEntry.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        projectId: data.projectId || null,
        description: data.description || null,
        billable: data.billable ?? true,
        start: new Date(),
        end: null,
        durationSeconds: null,
        amountCents: 0,
      },
      include: TIME_ENTRY_INCLUDE,
    });
  }

  static async stop(data: StopTimeEntryInput) {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: data.id,
        tenantId: data.tenantId,
        userId: data.userId,
      },
    });

    if (!entry) return null;

    const stopTime = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((stopTime.getTime() - entry.start.getTime()) / 1000),
    );
    const effectiveBillable =
      data.billable !== undefined ? data.billable : entry.billable;
    const effectiveProjectId =
      data.projectId !== undefined ? data.projectId : entry.projectId;

    const hourlyRateCents = effectiveBillable
      ? await getUserHourlyRateCents(data.userId)
      : 0;
    const amountCents = effectiveBillable
      ? calculateAmountCents(durationSeconds, hourlyRateCents)
      : 0;

    const updated = await prisma.timeEntry.update({
      where: { id: data.id },
      data: {
        end: stopTime,
        durationSeconds,
        amountCents,
        description:
          data.description !== undefined ? data.description : entry.description,
        projectId: effectiveProjectId,
        billable: effectiveBillable,
      },
      include: TIME_ENTRY_INCLUDE,
    });

    if (effectiveProjectId) {
      await ProjectModel.syncHealthStatus(effectiveProjectId);
    }

    return updated;
  }

  static async createManual(data: CreateManualTimeEntryInput) {
    const durationSeconds = Math.max(
      0,
      Math.floor((data.end.getTime() - data.start.getTime()) / 1000),
    );
    const billable = data.billable ?? true;
    const hourlyRateCents = billable
      ? await getUserHourlyRateCents(data.userId)
      : 0;
    const amountCents = billable
      ? calculateAmountCents(durationSeconds, hourlyRateCents)
      : 0;

    const created = await prisma.timeEntry.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        projectId: data.projectId || null,
        description: data.description || null,
        billable,
        start: data.start,
        end: data.end,
        durationSeconds,
        amountCents,
      },
      include: TIME_ENTRY_INCLUDE,
    });

    if (data.projectId) {
      await ProjectModel.syncHealthStatus(data.projectId);
    }

    return created;
  }

  static async update(data: UpdateTimeEntryInput) {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: data.id,
        tenantId: data.tenantId,
        userId: data.userId,
      },
    });

    if (!entry) return null;

    const newStart = data.start ?? entry.start;
    const newEnd = data.end !== undefined ? data.end : entry.end;
    let durationSeconds = entry.durationSeconds;

    if (newStart && newEnd) {
      durationSeconds = Math.max(
        0,
        Math.floor((newEnd.getTime() - newStart.getTime()) / 1000),
      );
    }

    const newBillable =
      data.billable !== undefined ? data.billable : entry.billable;
    const newProjectId =
      data.projectId !== undefined ? data.projectId : entry.projectId;

    let amountCents = 0;
    if (newBillable && durationSeconds !== null && durationSeconds !== undefined) {
      const hourlyRateCents = await getUserHourlyRateCents(data.userId);
      amountCents = calculateAmountCents(durationSeconds, hourlyRateCents);
    }

    const updated = await prisma.timeEntry.update({
      where: { id: data.id },
      data: {
        start: newStart,
        end: newEnd,
        durationSeconds,
        amountCents,
        description:
          data.description !== undefined ? data.description : entry.description,
        projectId: newProjectId,
        billable: newBillable,
      },
      include: TIME_ENTRY_INCLUDE,
    });

    if (entry.projectId && entry.projectId !== newProjectId) {
      await ProjectModel.syncHealthStatus(entry.projectId);
    }
    if (newProjectId) {
      await ProjectModel.syncHealthStatus(newProjectId);
    }

    return updated;
  }

  static async delete(id: string, tenantId: string, userId: string) {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id,
        tenantId,
        userId,
      },
      select: { id: true, projectId: true },
    });

    if (!entry) return false;

    await prisma.timeEntry.delete({
      where: { id },
    });

    if (entry.projectId) {
      await ProjectModel.syncHealthStatus(entry.projectId);
    }

    return true;
  }

  static async listRecent(
    tenantId: string,
    userId: string,
    filters: ListTimeEntriesFilter = {},
  ) {
    const { limit = 50, startDate, endDate, projectId, clientId } = filters;

    const where: Record<string, unknown> = {
      tenantId,
      userId,
      end: { not: null },
    };

    if (startDate || endDate) {
      const startFilter: { gte?: Date; lte?: Date } = {};
      if (startDate) startFilter.gte = startDate;
      if (endDate) startFilter.lte = endDate;
      where.start = startFilter;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (clientId) {
      where.project = {
        clientId,
      };
    }

    return prisma.timeEntry.findMany({
      where,
      orderBy: { start: "desc" },
      take: limit,
      include: TIME_ENTRY_INCLUDE,
    });
  }
}
