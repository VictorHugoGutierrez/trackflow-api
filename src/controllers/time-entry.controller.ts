import { Request, Response } from "express";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { TimeEntryModel } from "../models/time-entry.model.js";
import { AppError } from "../errors/app-error.js";

async function getUserHourlyRateCents(userId: string): Promise<number> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { hourlyRateCents: true },
  });
  return settings?.hourlyRateCents ?? 0;
}

async function validateTargetProject(
  tenantId: string,
  projectId?: string | null,
) {
  if (!projectId) return;

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId, active: true },
    select: { id: true, status: true },
  });

  if (!project) {
    throw new AppError("PROJECT_NOT_FOUND", "Projeto não encontrado ou inativo.", 404);
  }

  if (project.status === ProjectStatus.COMPLETED) {
    throw new AppError(
      "PROJECT_COMPLETED",
      "Não é possível registrar ou vincular horas em um projeto concluído.",
      400,
    );
  }
}

interface StartBody {
  projectId?: string;
  description?: string;
  billable?: boolean;
}

interface StopBody {
  description?: string;
  projectId?: string;
  billable?: boolean;
}

interface ManualEntryBody {
  projectId?: string;
  description?: string;
  billable?: boolean;
  start: string;
  end: string;
}

interface UpdateEntryBody {
  projectId?: string | null;
  description?: string;
  billable?: boolean;
  start?: string;
  end?: string;
}

interface EntryParams {
  id: string;
}

export class TimeEntryController {
  static async start(req: Request<{}, {}, StartBody>, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const userId = req.user!.sub;
    const body = req.body || {};

    if (body.projectId) {
      await validateTargetProject(tenantId, body.projectId);
    }

    const active = await TimeEntryModel.findActive(tenantId, userId);
    if (active) {
      // [Hardening] Se existir cronômetro ativo, encerra automaticamente
      await TimeEntryModel.stop({
        id: active.id,
        tenantId,
        userId,
      });
    }

    const entry = await TimeEntryModel.start({
      tenantId,
      userId,
      projectId: body.projectId,
      description: body.description,
      billable: body.billable,
      hourlyRateCents: await getUserHourlyRateCents(userId),
    });

    return res.status(201).json({
      success: true,
      data: entry,
    });
  }

  static async stop(req: Request<EntryParams, {}, StopBody>, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const userId = req.user!.sub;
    const { id } = req.params;
    const body = req.body || {};

    if (body.projectId) {
      await validateTargetProject(tenantId, body.projectId);
    }

    const updated = await TimeEntryModel.stop({
      id,
      tenantId,
      userId,
      description: body.description,
      projectId: body.projectId,
      billable: body.billable,
    });

    if (!updated) {
      throw new AppError(
        "TIME_ENTRY_NOT_FOUND",
        "Apontamento não encontrado ou pertencente a outro tenant.",
        404,
      );
    }

    return res.json({
      success: true,
      data: updated,
    });
  }

  static async getActive(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const userId = req.user!.sub;

    const active = await TimeEntryModel.findActive(tenantId, userId);

    return res.json({
      success: true,
      data: active,
    });
  }

  static async createManual(
    req: Request<{}, {}, ManualEntryBody>,
    res: Response,
  ) {
    const tenantId = req.user!.tenantId as string;
    const userId = req.user!.sub;
    const body = req.body || {};

    if (!body.start || !body.end) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Os campos 'start' e 'end' são obrigatórios para apontamentos manuais.",
        400,
      );
    }

    const startDate = new Date(body.start);
    const endDate = new Date(body.end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Formato inválido de data fornecido para 'start' ou 'end'.",
        400,
      );
    }

    if (endDate <= startDate) {
      throw new AppError(
        "VALIDATION_ERROR",
        "O horário de término ('end') deve ser posterior ao de início ('start').",
        400,
      );
    }

    if (body.projectId) {
      await validateTargetProject(tenantId, body.projectId);
    }

    const entry = await TimeEntryModel.createManual({
      tenantId,
      userId,
      projectId: body.projectId,
      description: body.description,
      billable: body.billable,
      start: startDate,
      end: endDate,
      hourlyRateCents: await getUserHourlyRateCents(userId),
    });

    return res.status(201).json({
      success: true,
      data: entry,
    });
  }

  static async update(
    req: Request<EntryParams, {}, UpdateEntryBody>,
    res: Response,
  ) {
    const tenantId = req.user!.tenantId as string;
    const userId = req.user!.sub;
    const { id } = req.params;
    const body = req.body || {};

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (body.start) {
      startDate = new Date(body.start);
      if (isNaN(startDate.getTime())) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Formato inválido de data para 'start'.",
          400,
        );
      }
    }

    if (body.end) {
      endDate = new Date(body.end);
      if (isNaN(endDate.getTime())) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Formato inválido de data para 'end'.",
          400,
        );
      }
    }

    if (startDate && endDate && endDate <= startDate) {
      throw new AppError(
        "VALIDATION_ERROR",
        "O horário de término ('end') deve ser posterior ao de início ('start').",
        400,
      );
    }

    const normalizedProjectId =
      body.projectId === undefined
        ? undefined
        : body.projectId
          ? String(body.projectId).trim()
          : null;

    if (normalizedProjectId) {
      await validateTargetProject(tenantId, normalizedProjectId);
    }

    const updated = await TimeEntryModel.update({
      id,
      tenantId,
      userId,
      description: body.description,
      projectId: normalizedProjectId,
      billable: body.billable,
      start: startDate,
      end: endDate,
      hourlyRateCents: await getUserHourlyRateCents(userId),
    });

    if (!updated) {
      throw new AppError(
        "TIME_ENTRY_NOT_FOUND",
        "Apontamento não encontrado ou pertencente a outro tenant.",
        404,
      );
    }

    return res.json({
      success: true,
      data: updated,
    });
  }

  static async delete(req: Request<EntryParams>, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const userId = req.user!.sub;
    const { id } = req.params;

    const deleted = await TimeEntryModel.delete(id, tenantId, userId);
    if (!deleted) {
      throw new AppError(
        "TIME_ENTRY_NOT_FOUND",
        "Apontamento não encontrado ou pertencente a outro tenant.",
        404,
      );
    }

    return res.status(204).send();
  }

  static async list(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const userId = req.user!.sub;

    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const startDate = req.query.startDate
      ? new Date(String(req.query.startDate))
      : undefined;
    const endDate = req.query.endDate
      ? new Date(String(req.query.endDate))
      : undefined;
    const projectId =
      typeof req.query.projectId === "string" && req.query.projectId
        ? req.query.projectId
        : undefined;
    const clientId =
      typeof req.query.clientId === "string" && req.query.clientId
        ? req.query.clientId
        : undefined;

    const isManagerOrOwner = ["OWNER", "MANAGER", "SUPER_ADMIN"].includes(
      req.user!.role,
    );
    const scope =
      isManagerOrOwner && req.query.scope === "tenant" ? "tenant" : "self";
    const filterUserId =
      scope === "tenant" &&
      typeof req.query.userId === "string" &&
      req.query.userId
        ? req.query.userId
        : undefined;

    const entries = await TimeEntryModel.listRecent(tenantId, userId, {
      limit: isNaN(limit) ? 50 : limit,
      startDate: startDate && !isNaN(startDate.getTime()) ? startDate : undefined,
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
      projectId,
      clientId,
      scope,
      userId: filterUserId,
    });

    return res.json({
      success: true,
      data: entries,
    });
  }
}
