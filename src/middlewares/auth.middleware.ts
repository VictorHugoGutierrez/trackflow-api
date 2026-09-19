import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError(
      "UNAUTHORIZED",
      "Sessão inválida ou expirada. Faça login novamente.",
      401,
    );
  }
}
