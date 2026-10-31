import { Request, Response } from "express";
import { ProjectStatus } from '@prisma/client';
import { ProjectModel } from "../models/project.model.js";
import { AppError } from "../errors/app-error.js";

interface CreateProjectBody {
  name: string;
  budgetHours?: number;
  status?: ProjectStatus;
  clientId?: string;
}

interface UpdateProjectBody{
  name?: string;
  budgetHours?: number;
  status?: ProjectStatus;
  clientId?: string;
}

interface ProjectParams {
  id: string;
}

export class ProjectController{
    static async createProject(
        req: Request<{}, {}, CreateProjectBody>,
            res: Response,
          )
          {
              const data = req.body;
              const tenantId = req.user!.tenantId;
          
              if (!data.name) {
                throw new AppError("NAME_REQUIRED", "O campo 'name' é obrigatório", 400);
              }
          
              const project = await ProjectModel.createProject({
                ...data,
                tenantId,
              });
          
              return res.status(201).json(project);
        }

    static async getProjects(req: Request, res: Response) {
        const tenantId = req.user!.tenantId;
    
        const project = await ProjectModel.findAllByTenant(tenantId);
        return res.status(200).json(project);
      }

    static async deleteProjects(req: Request<ProjectParams>, res: Response ){
      const tenantId = req.user!.tenantId
      const { id } = req.params

      const result = await ProjectModel.deleteProject({tenantId, id})
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
        const data = req.body;
        const tenantId = req.user!.tenantId;

    
        const result = await ProjectModel.alterProject({
          ...data,
          id,
          tenantId,
        });
    
        if (result.count === 0) {
          throw new AppError(
            "PROJECT_NOT_FOUND",
            "Projeto não encontrado ou sem permissão para alterar",
            404,
          );
        }
    
        return res.status(200).json({ message: "Projeto atualizado com sucesso" });
      }
    
}