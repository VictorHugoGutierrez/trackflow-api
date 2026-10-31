import { ProjectStatus } from '@prisma/client'
import { prisma } from "../lib/prisma.js"

interface CreateProjectInput {
  tenantId: string;
  name: string;
  budgetHours?: number;
  status?: ProjectStatus;
  clientId?: string;
}

interface AlterProjectInput {
  tenantId: string;
  id: string;
  name?: string;
  budgetHours?: number;
  status?: ProjectStatus;
  clientId?: string;
} 

interface DeleteProjectInput{
  tenantId: string;
  id: string;
}


export class ProjectModel {

    static async createProject(data: CreateProjectInput) {
        return prisma.project.create({ data }) 
    }

    static async findAllByTenant(tenantId: string){
        return prisma.project.findMany({
            where: { tenantId }
        })
    }

    static async alterProject(data: AlterProjectInput){
        return prisma.project.updateMany({
            where: { id: data.id, tenantId: data.tenantId },
            data:{
                name: data.name, 
                budgetHours: data.budgetHours, 
                status: data.status, 
                clientId: data.clientId
            }
        })
    }

    static async deleteProject(data: DeleteProjectInput){
        return prisma.project.deleteMany({
            where:{ id: data.id, tenantId: data.tenantId }
        })
    }

}