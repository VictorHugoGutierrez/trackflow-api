import { FastifyReply, FastifyRequest } from "fastify";
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

export class ClientController {
    static async createClient(req: FastifyRequest<{Body: CreateClientBody}>, res: FastifyReply){
        const data = req.body
        const tenantId = req.user.tenantId

        if (!data.name) {
            throw new AppError("NAME_REQUIRED", "O campo 'name' é obrigatório", 400);
        }

        return res.status(201).send(await ClientModel.createClient(tenantId, data));
    }

    static async getClients(req: FastifyRequest, res: FastifyReply){
        const tenantId = req.user.tenantId

        return res.status(200).send(await ClientModel.findAllByTenant(tenantId));
    }

    static async deleteClient(req: FastifyRequest<{Params: {id: string}}>, res: FastifyReply){
        const tenantId = req.user.tenantId
        const { id } = req.params

        const result =  await ClientModel.deleteClient(tenantId, id);

        if(result.count === 0 ){
            throw new AppError("CLIENT_NOT_FOUND","Cliente não encontrado ou sem permissão para deletar", 404);
        }

        return res.status(204).send()
    }

    static async alterClient(
    req: FastifyRequest<{ Params: { id: string }; Body: UpdateClientBody }>,
    res: FastifyReply
  ) {
    const { id } = req.params;
    const data = req.body; 
    const tenantId = req.user.tenantId;

    const result = await ClientModel.alterClient(tenantId, id, data);

    if (result.count === 0) {
      throw new AppError("CLIENT_NOT_FOUND","Cliente não encontrado ou sem permissão para alterar", 404);

    }

    return res.status(200).send({ message: "Cliente atualizado com sucesso" });
  }
}