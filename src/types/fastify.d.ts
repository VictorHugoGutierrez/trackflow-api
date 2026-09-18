import { Role } from "@prisma/client";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      tenantId: string;
      role: Role;
      sub: string;
    };
    user: {
      tenantId: string;
      role: Role;
      sub: string;
    };
  }
}
