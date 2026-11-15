import { Request, Response } from "express";
import { Ollama } from "ollama";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";

export class AiController {
  static async chat(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const { message } = req.body;

    if (!message) {
      throw new AppError("VALIDATION_ERROR", "Mensagem é obrigatória.", 400);
    }

    // Fetch context
    const tenantData = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        projects: { where: { status: "ACTIVE" }, take: 5 },
        timeEntries: { take: 10, orderBy: { start: "desc" } },
      },
    });

    const systemPrompt = `Você é um assistente do TrackFlow. Contexto do Tenant: ${JSON.stringify(tenantData)}. Responda de forma sucinta.`;

    const ollama = new Ollama({
      host: process.env.OLLAMA_API_URL || "https://ollama.com",
      headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY || ""}` },
    });

    const response = await ollama.chat({
      model: process.env.OLLAMA_API_MODEL || "gemma4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    return res.json({ success: true, data: response.message.content });
  }
}
