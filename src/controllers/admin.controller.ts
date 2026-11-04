import { Request, Response } from "express";
import { AdminModel } from "../models/admin.model.js";
import { AppError } from "../errors/app-error.js";

interface TenantParams {
  id: string;
}

interface UpdateTenantBody {
  name?: string;
  plan?: string;
  active?: boolean;
}

export class AdminController {
  static async getMetrics(_req: Request, res: Response) {
    const metrics = await AdminModel.getMetrics();
    return res.json({ success: true, data: metrics });
  }

  static async listTenants(req: Request, res: Response) {
    const { page, limit, search, plan, active } = req.query;

    let activeFilter: boolean | undefined = undefined;
    if (active === "true") activeFilter = true;
    if (active === "false") activeFilter = false;

    const result = await AdminModel.listTenants({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: typeof search === "string" ? search : undefined,
      plan: typeof plan === "string" ? plan : undefined,
      active: activeFilter,
    });

    return res.json({
      success: true,
      data: result.tenants,
      meta: result.meta,
    });
  }

  static async getTenant(req: Request<TenantParams>, res: Response) {
    const { id } = req.params;
    const tenant = await AdminModel.getTenantById(id);

    if (!tenant) {
      throw new AppError("NOT_FOUND", "Tenant não encontrado.", 404);
    }

    return res.json({ success: true, data: tenant });
  }

  static async updateTenant(
    req: Request<TenantParams, {}, UpdateTenantBody>,
    res: Response,
  ) {
    const { id } = req.params;
    const body = req.body || {};

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

    return res.json({ success: true, data: updated });
  }

  static async deleteTenant(req: Request<TenantParams>, res: Response) {
    const { id } = req.params;

    const existing = await AdminModel.getTenantById(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Tenant não encontrado.", 404);
    }

    await AdminModel.deleteTenant(id);

    return res.json({
      success: true,
      data: {
        message: "Tenant e todos os registros associados excluídos com sucesso.",
      },
    });
  }

  static async getLogs(_req: Request, res: Response) {
    const logs = await AdminModel.getSystemLogs();
    return res.json({ success: true, data: logs });
  }
}
