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

interface EntryParams {
  id: string;
}

export class TimeEntryController {
  static async start(req: Request<{}, {}, StartBody>, res: Response) {
    const { tenantId, sub: userId } = req.user!;
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
    const { tenantId, sub: userId } = req.user!;
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
    const { tenantId, sub: userId } = req.user!;

    const active = await TimeEntryModel.findActive(tenantId, userId);

    return res.json({
      success: true,
      data: active,
    });
  }

  static async list(req: Request, res: Response) {
    const { tenantId, sub: userId } = req.user!;

    const entries = await TimeEntryModel.listRecent(tenantId, userId);

    return res.json({
      success: true,
      data: entries,
    });
  }
}
