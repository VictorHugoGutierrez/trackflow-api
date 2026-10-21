import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { Prisma } from "@prisma/client";
import { AppError } from "./errors/app-error";
import type { ApiError } from "./types/api";
import { authRoutes } from "./routes/auth.routes";
import { timeEntryRoutes } from "./routes/time-entry.routes";
import { adminRoutes } from "./routes/admin.routes";
import { clientRoutes } from "./routes/client.routes";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("Variável de ambiente JWT_SECRET não definida no .env");
}

//#region Express App Initialization

export const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(cookieParser(jwtSecret));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//#endregion

//#region Health Check

app.get("/ping", (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      status: "online",
      timestamp: new Date().toISOString(),
    },
  });
});

//#endregion

//#region Routes

app.use(authRoutes);
app.use(timeEntryRoutes);
app.use(adminRoutes);
app.use(clientRoutes);

//#endregion

//#region Error Handler

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    const errorResponse: ApiError = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
    return res.status(error.statusCode).json(errorResponse);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[])?.join(", ") || "campo";
      const errorResponse: ApiError = {
        success: false,
        error: {
          code: "DUPLICATE_ENTRY",
          message: `Já existe um registo com este ${target}.`,
        },
      };
      return res.status(409).json(errorResponse);
    }

    if (error.code === "P2025") {
      const errorResponse: ApiError = {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "O registo solicitado não foi encontrado na base de dados.",
        },
      };
      return res.status(404).json(errorResponse);
    }
  }

  console.error(error);

  const internalResponse: ApiError = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Ocorreu um erro interno inesperado no servidor.",
    },
  };
  return res.status(500).json(internalResponse);
});

//#endregion

//#region Start Server

const port = Number(process.env.PORT) || 3333;

if (process.env.NODE_ENV == "development") {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

//#endregion

export default app;
