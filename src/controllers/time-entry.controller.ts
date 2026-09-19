import { FastifyReply, FastifyRequest } from "fastify";
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
  static async start(
    request: FastifyRequest<{ Body: StartBody }>,
    reply: FastifyReply,
  ) {
    const { tenantId, sub: userId } = request.user;
    const body = request.body || {};

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

    return reply.status(201).send({
      success: true,
      data: entry,
    });
  }

  static async stop(
    request: FastifyRequest<{ Params: EntryParams; Body: StopBody }>,
    reply: FastifyReply,
  ) {
    const { tenantId, sub: userId } = request.user;
    const { id } = request.params;
    const body = request.body || {};

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

    return reply.send({
      success: true,
      data: updated,
    });
  }

  static async getActive(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, sub: userId } = request.user;

    const active = await TimeEntryModel.findActive(tenantId, userId);

    return reply.send({
      success: true,
      data: active,
    });
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, sub: userId } = request.user;

    const entries = await TimeEntryModel.listRecent(tenantId, userId);

    return reply.send({
      success: true,
      data: entries,
    });
  }
}
