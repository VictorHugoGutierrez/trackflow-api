import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";

export function requireRole(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || !allowedRoles.includes(user.role)) {
      throw new AppError(
        "FORBIDDEN",
        "Apenas gestores ou proprietários possuem acesso a este recurso financeiro.",
        403,
      );
    }

    return next();
  };
}
