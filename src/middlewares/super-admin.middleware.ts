import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";

export function superAdminMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const user = req.user;

  if (!user || (user.role as string) !== "SUPER_ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Acesso restrito ao painel de administração global.",
      403,
    );
  }

  return next();
}
