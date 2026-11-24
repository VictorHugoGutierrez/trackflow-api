import { prisma } from "../lib/prisma.js"

interface CreateClientInput{
    tenantId: string, 
    name: string, 
    contact?: string | null
}

interface AlterClientInput{
    id: string,
    tenantId: string,
    name?: string,
    contact?: string | null,
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
        const updateData: { name?: string; contact?: string | null; active?: boolean } = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.contact !== undefined) updateData.contact = data.contact;
        if (data.active !== undefined) updateData.active = data.active;

        return prisma.client.updateMany({
            where: { id: data.id, tenantId: data.tenantId },
            data: updateData
        })
    }

    static async deactivateClient(data: DeleteClientInput) {
        const client = await prisma.client.findFirst({
            where: { id: data.id, tenantId: data.tenantId },
            include: { projects: true, invoices: true }
        });

        if (!client) return { count: 0 };

        if (client.projects.length > 0 || client.invoices.length > 0) {
            return prisma.client.updateMany({
                where: { id: data.id, tenantId: data.tenantId },
                data: { active: false }
            });
        }
        return prisma.client.deleteMany({
            where: { id: data.id, tenantId: data.tenantId }
        });
    }
}
