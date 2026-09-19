import { prisma } from "../lib/prisma";
import { Role } from "@prisma/client";

interface UpsertGoogleUserInput {
  email: string;
  name: string;
  avatarUrl?: string;
}

export class UserModel {
  static async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        settings: true,
      },
    });
  }

  static async createOwnerWithTenant(data: UpsertGoogleUserInput) {
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: `${data.name}'s Workspace`,
          plan: "freemium",
          active: true,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: data.email,
          name: data.name,
          avatarUrl: data.avatarUrl,
          role: Role.OWNER,
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

      return { user, tenant, settings };
    });
  }
}
