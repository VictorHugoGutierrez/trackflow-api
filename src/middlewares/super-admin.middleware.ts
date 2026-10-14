import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error";

export async function superAdminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = request.user;

  if (!user || (user.role as string) !== "SUPER_ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Acesso restrito ao painel de administração global.",
      403,
    );
  }
}
