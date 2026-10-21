import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/user.model.js";
import { AppError } from "../errors/app-error.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

interface GoogleAuthBody {
  idToken: string;
}

export class AuthController {
  static async googleLogin(
    req: Request<{}, {}, GoogleAuthBody>,
    res: Response,
  ) {
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

    let user = await UserModel.findByEmail(payload.email);

    if (!user) {
      const created = await UserModel.createOwnerWithTenant({
        email: payload.email,
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

    return res.status(200).json({
      success: true,
      data: {
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
    const user = await UserModel.findByEmail((req.user as any)?.email);

    return res.json({
      success: true,
      data: user,
    });
  }
}
