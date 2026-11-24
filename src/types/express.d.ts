import { Role } from "@prisma/client";

export interface UserPayload {
  tenantId?: string | null;
  role: Role;
  sub: string;
  email?: string;
  name?: string;
  active: boolean;
  mustChangePassword?: boolean;
  tenantName?: string | null;
  tenantPlan?: string | null;
  pomodoroWork?: number;
  pomodoroBreak?: number;
  theme?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}
