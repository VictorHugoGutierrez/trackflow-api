import { Request, Response } from "express";
import { TimeEntryModel } from "../models/time-entry.model.js";
import { AppError } from "../errors/app-error.js";

interface StartBody {
  projectId?: string;
  taskId?: string;
  description?: string;
  billable?: boolean;
}

interface StopBody {
  description?: string;
  projectId?: string;
  taskId?: string;
  billable?: boolean;
}

interface ManualEntryBody {
  projectId?: string;
  taskId?: string;
  description?: string;
  billable?: boolean;
  start: string;
  end: string;
}

interface UpdateEntryBody {
  projectId?: string | null;
  taskId?: string | null;
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

    const active = await TimeEntryModel.findActive(tenantId, userId);
    if (active) {
      throw new AppError(
        "TIMER_ALREADY_RUNNING",
        "Já existe um cronômetro ativo em andamento.",
        409,
        { activeEntryId: active.id },
      );
    }

    const entry = await TimeEntryModel.start({
      tenantId,
      userId,
      projectId: body.projectId,
      taskId: body.taskId,
      description: body.description,
      billable: body.billable,
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

    const updated = await TimeEntryModel.stop({
      id,
      tenantId,
      userId,
      description: body.description,
      projectId: body.projectId,
      taskId: body.taskId,
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

    const entry = await TimeEntryModel.createManual({
      tenantId,
      userId,
      projectId: body.projectId,
      taskId: body.taskId,
      description: body.description,
      billable: body.billable,
      start: startDate,
      end: endDate,
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

    const updated = await TimeEntryModel.update({
      id,
      tenantId,
      userId,
      description: body.description,
      projectId: body.projectId,
      taskId: body.taskId,
      billable: body.billable,
      start: startDate,
      end: endDate,
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
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const clientId =
      typeof req.query.clientId === "string" ? req.query.clientId : undefined;

    const entries = await TimeEntryModel.listRecent(tenantId, userId, {
      limit: isNaN(limit) ? 50 : limit,
      startDate: startDate && !isNaN(startDate.getTime()) ? startDate : undefined,
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
      projectId,
      clientId,
    });

    return res.json({
      success: true,
      data: entries,
    });
  }
}
