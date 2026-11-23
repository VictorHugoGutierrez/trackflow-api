import { Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";
import { runOllamaChat } from "../lib/ollama.js";
import { formatDurationHuman } from "../utils/formatters.js";

export class AiController {
  static async chat(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const { message } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      throw new AppError("VALIDATION_ERROR", "Mensagem é obrigatória.", 400);
    }

    const tenantData = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        plan: true,
        projects: {
          where: { status: "ACTIVE" },
          take: 5,
          select: { name: true, status: true, estimatedSeconds: true },
        },
        timeEntries: {
          take: 10,
          orderBy: { start: "desc" },
          select: {
            description: true,
            durationSeconds: true,
            start: true,
            project: { select: { name: true } },
          },
        },
      },
    });

    const projectsSummary = tenantData?.projects.length
      ? tenantData.projects
          .map((p) => {
            const est = p.estimatedSeconds
              ? ` (estimativa: ${formatDurationHuman(p.estimatedSeconds)})`
              : "";
            return `- ${p.name} [${p.status}]${est}`;
          })
          .join("\n")
      : "- Nenhum projeto ativo no momento.";

    const entriesSummary = tenantData?.timeEntries.length
      ? tenantData.timeEntries
          .map((entry) => {
            const dateStr = new Date(entry.start).toLocaleDateString("pt-BR");
            const proj = entry.project?.name || "Sem projeto";
            const desc = entry.description || "Sem descrição";
            const dur =
              entry.durationSeconds !== null
                ? formatDurationHuman(entry.durationSeconds)
                : "em andamento";
            return `- ${dateStr} | ${proj}: ${desc} (${dur})`;
          })
          .join("\n")
      : "- Nenhum apontamento recente.";

    const systemPrompt = [
      `Você é o assistente virtual do TrackFlow para o workspace "${tenantData?.name || "Workspace"}" (plano ${tenantData?.plan || "freemium"}).`,
      "Responda em português de forma clara, útil e sucinta com base nos dados abaixo.",
      "",
      "Projetos ativos:",
      projectsSummary,
      "",
      "Últimos apontamentos de tempo:",
      entriesSummary,
    ].join("\n");

    const reply = await runOllamaChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: message.trim() },
    ]);

    return res.json({ success: true, data: reply });
  }
}
