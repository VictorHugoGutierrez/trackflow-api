import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@trackflow.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@123456";
  const name = "Super Admin";

  const passwordHash = await bcrypt.hash(password, 10);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true },
  });

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { email },
      data: {
        role: Role.SUPER_ADMIN,
        password: passwordHash,
        tenantId: null,
      },
    });

    if (existingUser.tenantId) {
      await prisma.tenant.deleteMany({
        where: { id: existingUser.tenantId, name: "TrackFlow Control Plane" },
      });
    }

    console.log(JSON.stringify({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      tenantId: null,
      password,
    }));
    return;
  }

  const user = await prisma.user.create({
    data: {
      tenantId: null,
      email,
      name,
      password: passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  console.log(JSON.stringify({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: null,
    password,
  }));
}

main()
  .catch((e) => {
    console.error("Erro ao criar superadmin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
