import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { UserModel } from "../models/user.model.js";
import { AppError } from "../errors/app-error.js";

function getGoogleClient(): OAuth2Client {
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
}

interface GoogleAuthBody {
  idToken?: string;
  accessToken?: string;
}

interface RegisterBody {
  name: string;
  email: string;
  password: string;
  workspaceName?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface SessionUser {
  id: string;
  tenantId?: string | null;
  role: Role;
  email: string;
}

function issueAuthSession(res: Response, user: SessionUser): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("Variável de ambiente JWT_SECRET não definida no .env");
  }

  const token = jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId ?? null,
      role: user.role,
      email: user.email,
    },
    jwtSecret,
    {
      expiresIn: "7d",
    },
  );

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("trackflow_session", token, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
}

export class AuthController {
  static async register(req: Request<{}, {}, RegisterBody>, res: Response) {
    const { name, email, password, workspaceName } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      throw new AppError("VALIDATION_ERROR", "O campo 'name' é obrigatório.", 400);
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      throw new AppError("VALIDATION_ERROR", "O campo 'email' é obrigatório.", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      throw new AppError("VALIDATION_ERROR", "Formato de e-mail inválido.", 400);
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      throw new AppError(
        "VALIDATION_ERROR",
        "A senha deve conter no mínimo 6 caracteres.",
        400,
      );
    }

    const existingUser = await UserModel.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError(
        "EMAIL_ALREADY_EXISTS",
        "Já existe uma conta associada a este e-mail.",
        409,
      );
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const { user, tenant } = await UserModel.createOwnerWithPassword({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      workspaceName: workspaceName?.trim(),
    });

    const token = issueAuthSession(res, {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          plan: tenant.plan,
        },
      },
    });
  }

  static async login(req: Request<{}, {}, LoginBody>, res: Response) {
    const { email, password } = req.body;

    if (!email || typeof email !== "string" || !email.trim()) {
      throw new AppError("VALIDATION_ERROR", "O campo 'email' é obrigatório.", 400);
    }

    if (!password || typeof password !== "string" || !password.trim()) {
      throw new AppError("VALIDATION_ERROR", "O campo 'password' é obrigatório.", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserModel.findByEmail(normalizedEmail);

    if (!user) {
      throw new AppError(
        "INVALID_CREDENTIALS",
        "E-mail ou senha inválidos.",
        401,
      );
    }

    if (!user.password) {
      throw new AppError(
        "SOCIAL_AUTH_REQUIRED",
        "Esta conta foi registrada via Google. Por favor, utilize o botão 'Entrar com Google'.",
        400,
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError(
        "INVALID_CREDENTIALS",
        "E-mail ou senha inválidos.",
        401,
      );
    }

    if (user.role !== "SUPER_ADMIN" && user.tenant && !user.tenant.active) {
      throw new AppError(
        "TENANT_SUSPENDED",
        "O acesso deste workspace foi temporariamente suspenso. Entre em contato com o suporte.",
        403,
      );
    }

    const token = issueAuthSession(res, {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
        tenant: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name,
              plan: user.tenant.plan,
            }
          : null,
      },
    });
  }

  static async googleLogin(req: Request<{}, {}, GoogleAuthBody>, res: Response) {
    const { idToken, accessToken } = req.body;

    if (!idToken && !accessToken) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Token do Google não informado.",
        400,
      );
    }

    let payload: { email?: string; name?: string; picture?: string } | undefined;

    if (idToken) {
      try {
        const client = getGoogleClient();
        const ticket = await client.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const p = ticket.getPayload();
        if (p) {
          payload = { email: p.email, name: p.name, picture: p.picture };
        }
      } catch (err: any) {
        console.error("Erro na validação do token Google (idToken):", err?.message || err);
        throw new AppError(
          "UNAUTHORIZED",
          "Token do Google inválido ou expirado.",
          401,
        );
      }
    } else if (accessToken) {
      try {
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!userInfoRes.ok) {
          throw new Error(`Google userinfo status: ${userInfoRes.status}`);
        }
        const data = (await userInfoRes.json()) as any;
        payload = { email: data.email, name: data.name, picture: data.picture };
      } catch (err: any) {
        console.error("Erro na validação do token Google (accessToken):", err?.message || err);
        throw new AppError(
          "UNAUTHORIZED",
          "Token de acesso do Google inválido ou expirado.",
          401,
        );
      }
    }

    if (!payload?.email) {
      throw new AppError(
        "UNAUTHORIZED",
        "Falha ao obter informações da conta Google.",
        401,
      );
    }

    const { email, name, picture } = payload;

    let user = await UserModel.findByEmail(email);

    if (user && user.role !== "SUPER_ADMIN" && user.tenant && !user.tenant.active) {
      throw new AppError(
        "TENANT_SUSPENDED",
        "O acesso deste workspace foi temporariamente suspenso. Entre em contato com o suporte.",
        403,
      );
    }

    let tenant = user?.tenant;

    if (!user) {
      const result = await UserModel.createOwnerWithTenant({
        email,
        name: name || "Usuário",
        avatarUrl: picture,
      });

      user = result.user as any;
      tenant = result.tenant as any;
    }

    const token = issueAuthSession(res, {
      id: user!.id,
      tenantId: user!.tenantId,
      role: user!.role,
      email: user!.email,
    });

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user!.id,
          name: user!.name,
          email: user!.email,
          avatarUrl: user!.avatarUrl,
          role: user!.role,
        },
        tenant: tenant
          ? {
              id: tenant.id,
              name: tenant.name,
              plan: tenant.plan,
            }
          : null,
      },
    });
  }

  static async logout(_req: Request, res: Response) {
    res.clearCookie("trackflow_session", { path: "/" });
    return res.json({
      success: true,
      data: { message: "Sessão encerrada com sucesso." },
    });
  }

  static async me(req: Request, res: Response) {
    const email = (req.user as any)?.email;
    if (!email) {
      throw new AppError("UNAUTHORIZED", "Sessão inválida.", 401);
    }

    const user = await UserModel.findByEmail(email);

    if (!user) {
      throw new AppError("NOT_FOUND", "Usuário não encontrado.", 404);
    }

    const { password: _, ...safeUser } = user;

    return res.json({
      success: true,
      data: safeUser,
    });
  }

  static async updateSettings(req: Request, res: Response) {
    const userId = req.user!.sub;
    const { theme, pomodoroWork, pomodoroBreak, hourlyRate, currency } = req.body || {};

    const updated = await UserModel.updateSettings(userId, {
      theme: typeof theme === "string" ? theme : undefined,
      pomodoroWork: typeof pomodoroWork === "number" ? pomodoroWork : undefined,
      pomodoroBreak: typeof pomodoroBreak === "number" ? pomodoroBreak : undefined,
      hourlyRate: typeof hourlyRate === "number" ? hourlyRate : undefined,
      currency: typeof currency === "string" ? currency : undefined,
    });

    return res.json({
      success: true,
      data: updated,
    });
  }

  static async updateProfile(req: Request, res: Response) {
    const userId = req.user!.sub;
    const { name, avatarUrl } = req.body || {};

    const updated = await UserModel.updateProfile(userId, {
      name: typeof name === "string" ? name : undefined,
      avatarUrl: typeof avatarUrl === "string" ? avatarUrl : undefined,
    });

    return res.json({
      success: true,
      data: updated,
    });
  }
}
