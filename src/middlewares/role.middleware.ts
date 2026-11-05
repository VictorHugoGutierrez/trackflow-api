import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error.js";

export function requireRole(
  allowedRoles: string[],
  message = "Permissão insuficiente para acessar este recurso.",
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || !allowedRoles.includes(user.role)) {
      throw new AppError("FORBIDDEN", message, 403);
    }

    return next();
  };
}
