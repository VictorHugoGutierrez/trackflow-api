import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error.js";

export function requireTenant(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const user = req.user;

  if (!user?.tenantId) {
    throw new AppError(
      "TENANT_REQUIRED",
      "Esta operação requer que o usuário pertença a um workspace (tenant).",
      400,
    );
  }

  return next();
}
