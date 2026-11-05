import { prisma } from "../lib/prisma.js";

interface StartTimeEntryInput {
  tenantId: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  description?: string;
  billable?: boolean;
}

interface StopTimeEntryInput {
  id: string;
  tenantId: string;
  userId: string;
  description?: string;
  projectId?: string;
  taskId?: string;
  billable?: boolean;
}

interface CreateManualTimeEntryInput {
  tenantId: string;
  userId: string;
  projectId?: string;
  taskId?: string;
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
  taskId?: string | null;
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

export class TimeEntryModel {
  static async findActive(tenantId: string, userId: string) {
    return prisma.timeEntry.findFirst({
      where: {
        tenantId,
        userId,
        end: null,
      },
      include: {
        project: {
          include: {
            client: true,
          },
        },
        task: true,
      },
    });
  }

  static async start(data: StartTimeEntryInput) {
    return prisma.timeEntry.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        projectId: data.projectId || null,
        taskId: data.taskId || null,
        description: data.description || null,
        billable: data.billable ?? true,
        start: new Date(),
        end: null,
        duration: null,
      },
      include: {
        project: {
          include: {
            client: true,
          },
        },
        task: true,
      },
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
    const durationInSeconds = Math.max(
      0,
      Math.floor((stopTime.getTime() - entry.start.getTime()) / 1000),
    );

    return prisma.timeEntry.update({
      where: { id: data.id },
      data: {
        end: stopTime,
        duration: durationInSeconds,
        description:
          data.description !== undefined ? data.description : entry.description,
        projectId:
          data.projectId !== undefined ? data.projectId : entry.projectId,
        taskId: data.taskId !== undefined ? data.taskId : entry.taskId,
        billable: data.billable !== undefined ? data.billable : entry.billable,
      },
      include: {
        project: {
          include: {
            client: true,
          },
        },
        task: true,
      },
    });
  }

  static async createManual(data: CreateManualTimeEntryInput) {
    const durationInSeconds = Math.max(
      0,
      Math.floor((data.end.getTime() - data.start.getTime()) / 1000),
    );

    return prisma.timeEntry.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        projectId: data.projectId || null,
        taskId: data.taskId || null,
        description: data.description || null,
        billable: data.billable ?? true,
        start: data.start,
        end: data.end,
        duration: durationInSeconds,
      },
      include: {
        project: {
          include: {
            client: true,
          },
        },
        task: true,
      },
    });
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
    let duration = entry.duration;

    if (newStart && newEnd) {
      duration = Math.max(
        0,
        Math.floor((newEnd.getTime() - newStart.getTime()) / 1000),
      );
    }

    return prisma.timeEntry.update({
      where: { id: data.id },
      data: {
        start: newStart,
        end: newEnd,
        duration,
        description:
          data.description !== undefined ? data.description : entry.description,
        projectId:
          data.projectId !== undefined ? data.projectId : entry.projectId,
        taskId: data.taskId !== undefined ? data.taskId : entry.taskId,
        billable: data.billable !== undefined ? data.billable : entry.billable,
      },
      include: {
        project: {
          include: {
            client: true,
          },
        },
        task: true,
      },
    });
  }

  static async delete(id: string, tenantId: string, userId: string) {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id,
        tenantId,
        userId,
      },
    });

    if (!entry) return false;

    await prisma.timeEntry.delete({
      where: { id },
    });

    return true;
  }

  static async listRecent(
    tenantId: string,
    userId: string,
    filters: ListTimeEntriesFilter = {},
  ) {
    const { limit = 50, startDate, endDate, projectId, clientId } = filters;

    const where: any = {
      tenantId,
      userId,
      end: { not: null },
    };

    if (startDate || endDate) {
      where.start = {};
      if (startDate) {
        where.start.gte = startDate;
      }
      if (endDate) {
        where.start.lte = endDate;
      }
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
      include: {
        project: {
          include: {
            client: true,
          },
        },
        task: true,
      },
    });
  }
}
