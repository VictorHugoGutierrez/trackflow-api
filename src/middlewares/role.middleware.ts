import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error";

export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    if (!user || !allowedRoles.includes(user.role)) {
      throw new AppError(
        "FORBIDDEN",
        "Apenas gestores ou proprietários possuem acesso a este recurso financeiro.",
        403,
      );
    }
  };
}
