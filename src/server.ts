import Fastify, { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import dotenv from "dotenv";
import { Prisma } from "@prisma/client";
import { AppError } from "./errors/app-error";
import type { ApiError } from "./types/api";
import { authRoutes } from "./routes/auth.routes";
import { timeEntryRoutes } from "./routes/time-entry.routes";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("Variável de ambiente JWT_SECRET não definida no .env");
}

//#region Fastify App Initialization

export const app = Fastify({
  logger:
    process.env.NODE_ENV === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
        }
      : true,
});

app.register(cors, {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.register(cookie, {
  secret: jwtSecret,
  parseOptions: {},
});

app.register(jwt, {
  secret: jwtSecret,
  cookie: {
    cookieName: "trackflow_session",
    signed: false,
  },
});

//#endregion

//#region Routes

app.register(authRoutes);
app.register(timeEntryRoutes);

//#endregion

//#region Error Handler

app.setErrorHandler(
  (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      const errorResponse: ApiError = {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
      return reply.status(error.statusCode).send(errorResponse);
    }

    if (error.validation) {
      const errorResponse: ApiError = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Os dados fornecidos no pedido são inválidos.",
          details: error.validation,
        },
      };
      return reply.status(400).send(errorResponse);
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
        return reply.status(409).send(errorResponse);
      }

      if (error.code === "P2025") {
        const errorResponse: ApiError = {
          success: false,
          error: {
            code: "NOT_FOUND",
            message:
              "O registo solicitado não foi encontrado na base de dados.",
          },
        };
        return reply.status(404).send(errorResponse);
      }
    }

    app.log.error(error);

    const internalResponse: ApiError = {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Ocorreu um erro interno inesperado no servidor.",
      },
    };
    return reply.status(500).send(internalResponse);
  },
);

//#endregion

//#region Health Check
app.get("/ping", async () => {
  return {
    success: true,
    data: {
      status: "online",
      timestamp: new Date().toISOString(),
    },
  };
});

//#endregion

//#region Start Server

const port = Number(process.env.PORT) || 3333;
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`Server running on http://0.0.0.0:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

//#endregion
