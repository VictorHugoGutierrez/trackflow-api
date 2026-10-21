import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/app-error.js";
import { UserPayload } from "../types/express.js";

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    let token = req.cookies?.trackflow_session;

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        token = parts[1];
      }
    }

    if (!token) {
      throw new AppError(
        "UNAUTHORIZED",
        "Sessão inválida ou expirada. Faça login novamente.",
        401,
      );
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("Variável de ambiente JWT_SECRET não definida no .env");
    }

    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    req.user = decoded;
    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(
      new AppError(
        "UNAUTHORIZED",
        "Sessão inválida ou expirada. Faça login novamente.",
        401,
      ),
    );
  }
}
