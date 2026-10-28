import { prisma } from "../lib/prisma.js"

interface CreateClientInput{
    tenantId: string, 
    name: string, 
    contact?: string
}

interface AlterClientInput{
    id: string,
    tenantId: string,
    name: string,
    contact?: string,
    active?: boolean
}

interface DeleteClientInput{
  tenantId: string;
  id: string;
}

export class ClientModel {

    static async createClient(data: CreateClientInput){
        return prisma.client.create({ data }) 
    }

    static async findAllByTenant(tenantId: string){
        return prisma.client.findMany({
            where: { tenantId  }
        })
    }   

    static async alterClient(data: AlterClientInput){
        return prisma.client.updateMany({
            where: { id: data.id, tenantId: data.tenantId },
            data:{
                name: data.name,
                contact: data.contact,
                active: data.active
            }
        })
    }

    static async deleteClient(data: DeleteClientInput){
        return prisma.client.deleteMany({
            where:{ id: data.id, tenantId: data.tenantId }
        })
    }
}
