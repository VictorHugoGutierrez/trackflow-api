import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { calculateAmountCents, formatDurationHMS } from "../utils/formatters.js";

export interface CreateMemberInput {
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  hourlyRateCents?: number;
}

export interface UpdateMemberInput {
  name?: string;
  role?: Role;
  hourlyRateCents?: number;
}

export class TeamModel {
  static async listMembers(tenantId: string) {
    const members = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        settings: {
          select: {
            hourlyRateCents: true,
            currency: true,
          },
        },
        timeEntries: {
          where: { end: { not: null } },
          select: {
            durationSeconds: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return members.map((member) => {
      const hourlyRateCents = member.settings?.hourlyRateCents ?? 0;
      const totalSeconds = member.timeEntries.reduce(
        (sum, entry) => sum + (entry.durationSeconds || 0),
        0,
      );
      const totalCostCents = calculateAmountCents(totalSeconds, hourlyRateCents);

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        avatarUrl: member.avatarUrl,
        createdAt: member.createdAt,
        hourlyRateCents,
        currency: member.settings?.currency ?? "BRL",
        totalSeconds,
        totalCostCents,
      };
    });
  }

  static async findMemberById(id: string, tenantId: string) {
    return prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        settings: {
          select: {
            hourlyRateCents: true,
            currency: true,
          },
        },
      },
    });
  }

  static async createMember(data: CreateMemberInput) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: data.tenantId,
          name: data.name.trim(),
          email: data.email.toLowerCase().trim(),
          password: data.passwordHash,
          role: data.role,
        },
      });

      const settings = await tx.userSettings.create({
        data: {
          userId: user.id,
          hourlyRateCents: data.hourlyRateCents ?? 0,
          currency: "BRL",
          theme: "dark",
          pomodoroWork: 25,
          pomodoroBreak: 5,
        },
      });

      const { password: _, ...safeUser } = user;
      return {
        user: {
          ...safeUser,
          hourlyRateCents: settings.hourlyRateCents,
          currency: settings.currency,
        },
        settings,
      };
    });
  }

  static async updateMember(id: string, data: UpdateMemberInput) {
    return prisma.$transaction(async (tx) => {
      const userUpdate: { name?: string; role?: Role } = {};
      if (data.name !== undefined) {
        userUpdate.name = data.name.trim();
      }
      if (data.role !== undefined) {
        userUpdate.role = data.role;
      }

      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({
          where: { id },
          data: userUpdate,
        });
      }

      if (data.hourlyRateCents !== undefined) {
        await tx.userSettings.upsert({
          where: { userId: id },
          update: {
            hourlyRateCents: data.hourlyRateCents,
          },
          create: {
            userId: id,
            hourlyRateCents: data.hourlyRateCents,
            currency: "BRL",
            theme: "dark",
            pomodoroWork: 25,
            pomodoroBreak: 5,
          },
        });
      }

      const updated = await tx.user.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          settings: {
            select: {
              hourlyRateCents: true,
              currency: true,
            },
          },
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        avatarUrl: updated.avatarUrl,
        createdAt: updated.createdAt,
        hourlyRateCents: updated.settings?.hourlyRateCents ?? 0,
        currency: updated.settings?.currency ?? "BRL",
      };
    });
  }

  static async getMemberActivity(id: string, tenantId: string) {
    const member = await prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        settings: {
          select: {
            hourlyRateCents: true,
            currency: true,
          },
        },
      },
    });

    if (!member) {
      return null;
    }

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        userId: id,
        end: { not: null },
      },
      include: {
        project: {
          include: {
            client: true,
          },
        },
      },
      orderBy: { start: "desc" },
    });

    const hourlyRateCents = member.settings?.hourlyRateCents ?? 0;
    let totalSeconds = 0;

    const projectMap = new Map<
      string,
      {
        projectId: string | null;
        projectName: string;
        clientName: string | null;
        totalSeconds: number;
        costCents: number;
        entriesCount: number;
      }
    >();

    for (const entry of entries) {
      const secs = entry.durationSeconds || 0;
      totalSeconds += secs;
      const entryCostCents = calculateAmountCents(secs, hourlyRateCents);
      const key = entry.projectId || "__no_project__";
      const existing = projectMap.get(key);
      if (existing) {
        existing.totalSeconds += secs;
        existing.costCents += entryCostCents;
        existing.entriesCount += 1;
      } else {
        projectMap.set(key, {
          projectId: entry.projectId,
          projectName: entry.project?.name || "Sem Projeto",
          clientName: entry.project?.client?.name || null,
          totalSeconds: secs,
          costCents: entryCostCents,
          entriesCount: 1,
        });
      }
    }

    const projects = Array.from(projectMap.values())
      .map((item) => ({
        ...item,
        formattedDuration: formatDurationHMS(item.totalSeconds),
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    const recentEntries = entries.slice(0, 20).map((entry) => ({
      id: entry.id,
      description: entry.description,
      start: entry.start,
      end: entry.end,
      durationSeconds: entry.durationSeconds || 0,
      formattedDuration: formatDurationHMS(entry.durationSeconds),
      amountCents: calculateAmountCents(
        entry.durationSeconds || 0,
        hourlyRateCents,
      ),
      billable: entry.billable,
      project: entry.project
        ? {
            id: entry.project.id,
            name: entry.project.name,
            client: entry.project.client
              ? { id: entry.project.client.id, name: entry.project.client.name }
              : null,
          }
        : null,
    }));

    return {
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        avatarUrl: member.avatarUrl,
        hourlyRateCents,
        currency: member.settings?.currency ?? "BRL",
      },
      summary: {
        totalSeconds,
        formattedTotalDuration: formatDurationHMS(totalSeconds),
        totalCostCents: calculateAmountCents(totalSeconds, hourlyRateCents),
        projectsCount: projects.length,
        entriesCount: entries.length,
      },
      projects,
      recentEntries,
    };
  }

  static async deleteMember(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }
}
