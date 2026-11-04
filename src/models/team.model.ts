import { prisma } from "../lib/prisma.js";
import { Role } from "@prisma/client";

export interface CreateMemberInput {
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export class TeamModel {
  static async listMembers(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
  }

  static async findMemberById(id: string, tenantId: string) {
    return prisma.user.findFirst({
      where: {
        id,
        tenantId,
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
          hourlyRate: 0.0,
          currency: "BRL",
          theme: "dark",
          pomodoroWork: 25,
          pomodoroBreak: 5,
        },
      });

      const { password: _, ...safeUser } = user;
      return { user: safeUser, settings };
    });
  }

  static async deleteMember(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }
}
