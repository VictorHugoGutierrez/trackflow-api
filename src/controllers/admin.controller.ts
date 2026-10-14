import { FastifyReply, FastifyRequest } from "fastify";
import { AdminModel } from "../models/admin.model";
import { AppError } from "../errors/app-error";
import { request } from "http";

interface UpdateTenantParams {
  id: string;
}

interface UpdateTenantBody {
  name?: string;
  plan?: string;
  active?: boolean;
}

export class AdminController {
  // GET /api/admin/metrics
  static async getMetrics(request: FastifyRequest, reply: FastifyReply) {
    const metrics = await AdminModel.getMetrics();
    return reply.send({ success: true, data: metrics });
  }

  // GET /api/admin/tenants
  static async listTenants(request: FastifyRequest, reply: FastifyReply) {
    const tenants = await AdminModel.listTenants();
    return reply.send({ success: true, data: tenants });
  }

  // PATCH /api/admin/tenants/:id
  static async updateTenant(
    request: FastifyRequest<{
      Params: UpdateTenantParams;
      Body: UpdateTenantBody;
    }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const body = request.body || {};

    if (
      body.plan === undefined &&
      body.name === undefined &&
      body.active === undefined
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Informe ao menos um campo para atualizar (plan, active ou name).",
        400,
      );
    }

    const updated = await AdminModel.updateTenant(id, {
      name: body.name,
      plan: body.plan,
      active: body.active,
    });

    return reply.send({ success: true, data: updated });
  }
}
