import { prisma } from "../lib/prisma";

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

export class TimeEntryModel {
  static async findActive(tenantId: string, userId: string) {
    return prisma.timeEntry.findFirst({
      where: {
        tenantId,
        userId,
        end: null,
      },
      include: {
        project: true,
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
        project: true,
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
        project: true,
        task: true,
      },
    });
  }

  static async listRecent(tenantId: string, userId: string, limit = 50) {
    return prisma.timeEntry.findMany({
      where: {
        tenantId,
        userId,
        end: { not: null },
      },
      orderBy: { start: "desc" },
      take: limit,
      include: {
        project: true,
        task: true,
      },
    });
  }
}
