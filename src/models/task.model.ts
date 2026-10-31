import { TaskStatus } from '@prisma/client'
import { prisma } from "../lib/prisma.js"

interface CreateTaskInput {
  tenantId: string;
  projectId: string;
  title: string;
  status?: TaskStatus;
  estimatedHours?: number;
}


interface AlterTaskInput{
  id: string;
  tenantId: string;
  projectId?: string;
  title?: string;
  status?: TaskStatus;
  estimatedHours?: number;
}

interface DeleteTaskInput{
  id: string; 
  tenantId: string;
}

export class TaskModel{
    static async createTask(data: CreateTaskInput){
        return prisma.task.create({ data }) 
    }

    static async findAllByProject(tenantId: string, projectId: string){
        return prisma.task.findMany({
            where: { tenantId, projectId}
        })
    }


    static async alterTask(data: AlterTaskInput){
        return prisma.task.updateMany({
            where:{id: data.id, tenantId: data.tenantId},
            data:{
                projectId: data.projectId,
                title: data.title,
                status: data.status,
                estimatedHours: data.estimatedHours
            }
        })
    }

      static async deleteTask(data: DeleteTaskInput){
            return prisma.task.deleteMany({
                where:{ id: data.id, tenantId: data.tenantId }
            })
        }
}