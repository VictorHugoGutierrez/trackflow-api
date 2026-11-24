import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";
import { UserPayload } from "../types/express.js";

const DEV_BYPASS_IDS = new Set(["admin-dev-id", "user-dev-id"]);

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    let token = req.cookies?.trackflow_session;

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        token = parts[1];
      }
    }

    if (!token) {
      throw new AppError(
        "UNAUTHORIZED",
        "Sessão inválida ou expirada. Faça login novamente.",
        401,
      );
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("Variável de ambiente JWT_SECRET não definida no .env");
    }

    const decoded = jwt.verify(token, jwtSecret) as UserPayload;

    if (
      process.env.NODE_ENV !== "production" &&
      DEV_BYPASS_IDS.has(decoded.sub)
    ) {
      req.user = decoded;
      return next();
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        tenantId: true,
        mustChangePassword: true,
        tenant: {
          select: {
            active: true,
            name: true,
            plan: true,
          },
        },
        settings: {
          select: {
            pomodoroWork: true,
            pomodoroBreak: true,
            theme: true,
          },
        },
      },
    });

    if (!dbUser || !dbUser.active) {
      throw new AppError("UNAUTHORIZED", "Conta inativa ou removida.", 401);
    }

    if (
      dbUser.role !== "SUPER_ADMIN" &&
      dbUser.tenant &&
      !dbUser.tenant.active
    ) {
      throw new AppError(
        "TENANT_SUSPENDED",
        "O acesso deste workspace foi temporariamente suspenso. Entre em contato com o suporte.",
        403,
      );
    }

    req.user = {
      sub: dbUser.id,
      tenantId: dbUser.tenantId,
      role: dbUser.role,
      email: dbUser.email,
      name: dbUser.name,
      active: dbUser.active,
      mustChangePassword: dbUser.mustChangePassword,
      tenantName: dbUser.tenant?.name ?? null,
      tenantPlan: dbUser.tenant?.plan ?? null,
      pomodoroWork: dbUser.settings?.pomodoroWork ?? 25,
      pomodoroBreak: dbUser.settings?.pomodoroBreak ?? 5,
      theme: dbUser.settings?.theme ?? "dark",
    };

    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(
      new AppError(
        "UNAUTHORIZED",
        "Sessão inválida ou expirada. Faça login novamente.",
        401,
      ),
    );
  }
}
