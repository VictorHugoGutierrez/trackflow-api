import { Request, Response } from "express";
import { ProjectStatus } from "@prisma/client";
import { ProjectModel } from "../models/project.model.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../errors/app-error.js";
import { parseReaisToCents } from "../utils/formatters.js";

interface CreateProjectBody {
  name: string;
  budgetCents?: number | null;
  budgetReais?: number | string | null;
  estimatedSeconds?: number | null;
  estimatedHours?: number | string | null;
  status?: ProjectStatus;
  clientId?: string | null;
}

interface UpdateProjectBody {
  name?: string;
  budgetCents?: number | null;
  budgetReais?: number | string | null;
  estimatedSeconds?: number | null;
  estimatedHours?: number | string | null;
  status?: ProjectStatus;
  clientId?: string | null;
}

interface ProjectParams {
  id: string;
}

const VALID_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.ACTIVE,
  ProjectStatus.COMPLETED,
  ProjectStatus.OVER_BUDGET,
];

function resolveNullableInt(
  directValue: unknown,
  fallbackReaisOrHours: unknown,
  converter: (v: unknown) => number,
): number | null | undefined {
  if (directValue === null) return null;
  if (directValue !== undefined && directValue !== "") {
    const parsed = Math.round(Number(directValue));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  if (fallbackReaisOrHours === null) return null;
  if (fallbackReaisOrHours !== undefined && fallbackReaisOrHours !== "") {
    return converter(fallbackReaisOrHours);
  }
  return undefined;
}

function hoursToSeconds(val: unknown): number {
  const normalized = String(val ?? 0).trim().replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 3600);
}

export class ProjectController {
  static async createProject(
    req: Request<{}, {}, CreateProjectBody>,
    res: Response,
  ) {
    const data = req.body || {};
    const tenantId = req.user!.tenantId as string;

    if (!data.name || !String(data.name).trim()) {
      throw new AppError("NAME_REQUIRED", "O campo 'name' é obrigatório", 400);
    }

    if (data.status && !VALID_PROJECT_STATUSES.includes(data.status)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Status de projeto inválido. Utilize ACTIVE, COMPLETED ou OVER_BUDGET.",
        400,
      );
    }

    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, tenantId, active: true },
        select: { id: true },
      });
      if (!client) {
        throw new AppError(
          "CLIENT_NOT_FOUND",
          "Cliente não encontrado ou inativo neste workspace.",
          404,
        );
      }
    }

    const budgetCents = resolveNullableInt(
      data.budgetCents,
      data.budgetReais,
      parseReaisToCents,
    );
    const estimatedSeconds = resolveNullableInt(
      data.estimatedSeconds,
      data.estimatedHours,
      hoursToSeconds,
    );

    const project = await ProjectModel.createProject({
      tenantId,
      name: data.name,
      clientId: data.clientId || null,
      budgetCents: budgetCents ?? null,
      estimatedSeconds: estimatedSeconds ?? null,
      status: data.status || ProjectStatus.ACTIVE,
    });

    return res.status(201).json({ success: true, data: project });
  }

  static async getProjects(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;

    const projects = await ProjectModel.findAllByTenant(tenantId);
    return res.status(200).json({ success: true, data: projects });
  }

  static async deleteProject(req: Request<ProjectParams>, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const { id } = req.params;

    const result = await ProjectModel.deactivateProject({ tenantId, id });
    if (result.count === 0) {
      throw new AppError(
        "PROJECT_NOT_FOUND",
        "Projeto não encontrado ou sem permissão para deletar",
        404,
      );
    }
    return res.status(204).send();
  }

  static async alterProject(
    req: Request<ProjectParams, {}, UpdateProjectBody>,
    res: Response,
  ) {
    const { id } = req.params;
    const data = req.body || {};
    const tenantId = req.user!.tenantId as string;

    if (data.status && !VALID_PROJECT_STATUSES.includes(data.status)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Status de projeto inválido. Utilize ACTIVE, COMPLETED ou OVER_BUDGET.",
        400,
      );
    }

    const normalizedClientId =
      data.clientId === undefined
        ? undefined
        : data.clientId
          ? String(data.clientId).trim()
          : null;

    if (normalizedClientId) {
      const client = await prisma.client.findFirst({
        where: { id: normalizedClientId, tenantId, active: true },
        select: { id: true },
      });
      if (!client) {
        throw new AppError(
          "CLIENT_NOT_FOUND",
          "Cliente não encontrado ou inativo neste workspace.",
          404,
        );
      }
    }

    const budgetCents = resolveNullableInt(
      data.budgetCents,
      data.budgetReais,
      parseReaisToCents,
    );
    const estimatedSeconds = resolveNullableInt(
      data.estimatedSeconds,
      data.estimatedHours,
      hoursToSeconds,
    );

    const result = await ProjectModel.alterProject({
      id,
      tenantId,
      name: data.name,
      clientId: normalizedClientId,
      budgetCents,
      estimatedSeconds,
      status: data.status,
    });

    if (result.count === 0) {
      throw new AppError(
        "PROJECT_NOT_FOUND",
        "Projeto não encontrado ou sem permissão para alterar",
        404,
      );
    }

    return res.status(200).json({
      success: true,
      data: { message: "Projeto atualizado com sucesso" },
    });
  }

  static async updateStatus(req: Request, res: Response) {
    const id = req.params.id as string;
    const tenantId = req.user!.tenantId as string;
    const rawStatus = typeof req.body?.status === "string"
      ? req.body.status.trim().toUpperCase()
      : "";

    if (rawStatus !== "ACTIVE" && rawStatus !== "COMPLETED") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Status inválido. Informe 'COMPLETED' para concluir ou 'ACTIVE' para reabrir.",
        400,
      );
    }

    const updated = await ProjectModel.updateStatus(
      tenantId,
      id,
      rawStatus as "ACTIVE" | "COMPLETED",
    );

    if (!updated) {
      throw new AppError(
        "PROJECT_NOT_FOUND",
        "Projeto não encontrado neste workspace.",
        404,
      );
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  }
}
