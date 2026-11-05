import { Request, Response } from "express";
import { ClientModel } from "../models/client.model.js";
import { AppError } from "../errors/app-error.js";

interface CreateClientBody {
  name: string;
  contact?: string;
}

interface UpdateClientBody {
  name?: string;
  contact?: string;
  active?: boolean;
}

interface ClientParams {
  id: string;
}

export class ClientController {
  static async createClient(
    req: Request<{}, {}, CreateClientBody>,
    res: Response,
  ) {
    const data = req.body;
    const tenantId = req.user!.tenantId as string;

    if (!data.name) {
      throw new AppError("NAME_REQUIRED", "O campo 'name' é obrigatório", 400);
    }

    const client = await ClientModel.createClient({
      ...data,
      tenantId,
    });

    return res.status(201).json({ success: true, data: client });
  }

  static async getClients(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;

    const clients = await ClientModel.findAllByTenant(tenantId);
    return res.status(200).json({ success: true, data: clients });
  }

  static async deleteClient(req: Request<ClientParams>, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const { id } = req.params;

    const result = await ClientModel.deleteClient({ tenantId, id });

    if (result.count === 0) {
      throw new AppError(
        "CLIENT_NOT_FOUND",
        "Cliente não encontrado ou sem permissão para deletar",
        404,
      );
    }

    return res.status(204).send();
  }

  static async alterClient(
    req: Request<ClientParams, {}, UpdateClientBody>,
    res: Response,
  ) {
    const { id } = req.params;
    const data = req.body;
    const tenantId = req.user!.tenantId as string;

    const result = await ClientModel.alterClient({
      ...data,
      id,
      tenantId,
    });

    if (result.count === 0) {
      throw new AppError(
        "CLIENT_NOT_FOUND",
        "Cliente não encontrado ou sem permissão para alterar",
        404,
      );
    }

    return res.status(200).json({
      success: true,
      data: { message: "Cliente atualizado com sucesso" },
    });
  }
}
