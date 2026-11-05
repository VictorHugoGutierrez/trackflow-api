import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { Prisma } from "@prisma/client";
import { AppError } from "./errors/app-error.js";
import type { ApiError } from "./types/api.js";
import { authRoutes } from "./routes/auth.routes.js";
import { timeEntryRoutes } from "./routes/time-entry.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { clientRoutes } from "./routes/client.routes.js";
import { projectRoutes } from "./routes/project.routes.js";
import { taskRoutes } from "./routes/task.routes.js";
import { teamRoutes } from "./routes/team.routes.js";
import { invoiceRoutes } from "./routes/invoice.routes.js";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("Variável de ambiente JWT_SECRET não definida no .env");
}

export const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

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

app.get(["/ping", "/api/ping"], (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      status: "online",
      timestamp: new Date().toISOString(),
    },
  });
});

app.use(authRoutes);
app.use(timeEntryRoutes);
app.use(clientRoutes);
app.use(projectRoutes);
app.use(taskRoutes);
app.use(teamRoutes);
app.use(invoiceRoutes);
app.use(adminRoutes);

app.use((_req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Rota não encontrada.",
    },
  });
});

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

const port = Number(process.env.PORT) || 3333;

if (process.env.NODE_ENV !== "production") {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
