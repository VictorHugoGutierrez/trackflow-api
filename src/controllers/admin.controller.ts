import { Request, Response } from "express";
import { AdminModel } from "../models/admin.model.js";
import { AppError } from "../errors/app-error.js";

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
  static async getMetrics(_req: Request, res: Response) {
    const metrics = await AdminModel.getMetrics();
    return res.json({ success: true, data: metrics });
  }

  // GET /api/admin/tenants
  static async listTenants(_req: Request, res: Response) {
    const tenants = await AdminModel.listTenants();
    return res.json({ success: true, data: tenants });
  }

  // PATCH /api/admin/tenants/:id
  static async updateTenant(
    req: Request<UpdateTenantParams, {}, UpdateTenantBody>,
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
}
