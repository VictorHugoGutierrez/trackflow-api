import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { UserModel } from "../models/user.model";
import { AppError } from "../errors/app-error";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

interface GoogleAuthBody {
  idToken: string;
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
  tenantId: string;
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
      tenantId: user.tenantId,
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

    const token = issueAuthSession(res, user);

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

    if (!email || !password) {
      throw new AppError(
        "VALIDATION_ERROR",
        "E-mail e senha são obrigatórios.",
        400,
      );
    }

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
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
        "AUTH_METHOD_NOT_SUPPORTED",
        "Esta conta foi criada com o Google. Por favor, utilize o login com Google.",
        400,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(
        "INVALID_CREDENTIALS",
        "E-mail ou senha inválidos.",
        401,
      );
    }

    if (!user.tenant.active) {
      throw new AppError(
        "FORBIDDEN",
        "Workspace desativado. Contate o administrador.",
        403,
      );
    }

    const token = issueAuthSession(res, user);

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
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          plan: user.tenant.plan,
        },
      },
    });
  }

  static async googleLogin(req: Request<{}, {}, GoogleAuthBody>, res: Response) {
    const { idToken } = req.body;

    if (!idToken) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Token do Google não informado.",
        400,
      );
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new AppError(
        "UNAUTHORIZED",
        "Token do Google inválido ou expirado.",
        401,
      );
    }

    if (!payload?.email || !payload?.name) {
      throw new AppError(
        "UNAUTHORIZED",
        "Dados de conta incompletos no provedor.",
        400,
      );
    }

    let user = await UserModel.findByEmail(payload.email.toLowerCase().trim());

    if (!user) {
      const created = await UserModel.createOwnerWithTenant({
        email: payload.email.toLowerCase().trim(),
        name: payload.name,
        avatarUrl: payload.picture,
      });
      user = {
        ...created.user,
        tenant: created.tenant,
        settings: created.settings,
      };
    }

    if (!user.tenant.active) {
      throw new AppError(
        "FORBIDDEN",
        "Workspace desativado. Contate o administrador.",
        403,
      );
    }

    const token = issueAuthSession(res, user);

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
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          plan: user.tenant.plan,
        },
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
}
