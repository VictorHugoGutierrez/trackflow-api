import { FastifyReply, FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";
import { UserModel } from "../models/user.model";
import { AppError } from "../errors/app-error";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

interface GoogleAuthBody {
  idToken: string;
}

export class AuthController {
  static async googleLogin(
    request: FastifyRequest<{ Body: GoogleAuthBody }>,
    reply: FastifyReply,
  ) {
    const { idToken } = request.body;

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

    const token = await reply.jwtSign(
      {
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
      },
      {
        expiresIn: "7d",
      },
    );

    const isProduction = process.env.NODE_ENV === "production";

    reply.setCookie("trackflow_session", token, {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.status(200).send({
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

  static async logout(request: FastifyRequest, reply: FastifyReply) {
    reply.clearCookie("trackflow_session", { path: "/" });
    return reply.send({
      success: true,
      data: { message: "Sessão encerrada com sucesso." },
    });
  }

  static async me(request: FastifyRequest, reply: FastifyReply) {
    const { sub: userId } = request.user as { sub: string };

    const user = await UserModel.findByEmail((request.user as any).email);

    return reply.send({
      success: true,
      data: user,
    });
  }
}
