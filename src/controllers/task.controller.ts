import { Request, Response } from "express";
import { TaskModel } from "../models/task.model.js";
import { TaskStatus } from '@prisma/client'
import { AppError } from "../errors/app-error.js";

interface CreateTaskBody{
    projectId: string;
    title: string;
    status?: TaskStatus;
    estimatedHours?: number;
}

interface UpdateTaskBody{
    projectId?: string;
    title?: string;
    status?: TaskStatus;
    estimatedHours?: number;
}

interface TaskParams{
    id: string
}

export class TaskController{
    static async createTask(req: Request<{}, {}, CreateTaskBody>,res: Response,)
    {
        const data = req.body;
        const tenantId = req.user!.tenantId;
              
        if (!data.title || !data.projectId) {
            const field = !data.title ? "title" : "projectId";
            throw new AppError("FIELD_REQUIRED",`O campo '${field}' é obrigatório`,400);
        }
              
        const task = await TaskModel.createTask({ ...data, tenantId,});
              
        return res.status(201).json({ success: true, data: task });
    }

    static async getTasks(req: Request, res: Response){ 
        const tenantId = req.user!.tenantId;
        const projectId = req.query.projectId
        
        if(typeof projectId !== "string") {
            throw new AppError("PROJECTID_REQUIRED", "O campo projectID é obrigatório",400);
        }
        const task = await TaskModel.findAllByProject(tenantId, projectId);
        return res.status(200).json({ success: true, data: task });
    }

    static async deleteTask(req: Request<TaskParams>, res: Response ){
          const tenantId = req.user!.tenantId
          const { id } = req.params
    
          const result = await TaskModel.deleteTask({tenantId, id})
          if (result.count === 0) {
            throw new AppError("TASK_NOT_FOUND", "Tarefa não encontrada ou sem permissão para alt", 404);
          }
          return res.status(204).send();
        }
    
        static async alterTask(req: Request<TaskParams, {}, UpdateTaskBody>,res: Response,) {
            const { id } = req.params;
            const data = req.body;
            const tenantId = req.user!.tenantId;
    
            const result = await TaskModel.alterTask({ ...data, id, tenantId,});
        
            if (result.count === 0) {
                throw new AppError("TASK_NOT_FOUND", "Tarefa não encontrada ou sem permissão para deletar", 404);
            }
        
            return res.status(200).json({
                success: true,
                data: { message: "Tarefa atualizada com sucesso" },
            });
        }
}