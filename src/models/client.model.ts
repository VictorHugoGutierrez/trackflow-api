import { prisma } from "../lib/prisma.js"

export class ClientModel {

    static async createClient(tenantId: string, data: {name: string, contact?: string}){
        return prisma.client.create({
            data: {
                ...data,
                tenantId,
            },
        }) 
    }

    static async findAllByTenant(tenantId: string){
        return prisma.client.findMany({
            where: { tenantId  }
        })
    }   

    static async alterClient(tenantId: string, id: string, data: {name?: string, contact?: string, active?: boolean}){
        return prisma.client.updateMany({
            where: { id, tenantId },
            data
        })
    }

    static async deleteClient(tenantId: string, id: string){
        return prisma.client.deleteMany({
            where:{ id, tenantId }
        })
    }
}
