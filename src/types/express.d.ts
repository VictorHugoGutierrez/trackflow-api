import { Role } from "@prisma/client";

export interface UserPayload {
  tenantId?: string | null;
  role: Role;
  sub: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}
