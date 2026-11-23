import { Ollama, type Message, type Options } from "ollama";
import { AppError } from "../errors/app-error.js";

export interface OllamaConfig {
  host: string;
  apiKey: string;
  model: string;
  displayModel: string;
}

export type OllamaHealthStatus =
  | "connected"
  | "missing_api_key"
  | "unauthorized"
  | "credits_required"
  | "degraded"
  | "unreachable";

export interface OllamaHealthResult {
  status: OllamaHealthStatus;
  model: string;
  resolvedModel: string;
  host: string;
  message?: string;
}

export function resolveOllamaConfig(): OllamaConfig {
  const host = (process.env.OLLAMA_API_URL || "https://ollama.com")
    .trim()
    .replace(/\/+$/, "");
  const apiKey = (process.env.OLLAMA_API_KEY || "").trim();
  const displayModel = (
    process.env.OLLAMA_API_MODEL || "gemma4:31b-cloud"
  ).trim();
  const model = displayModel.replace(/[-:]cloud$/i, "");

  return {
    host,
    apiKey,
    model,
    displayModel,
  };
}

export function createOllamaClient(config: OllamaConfig): Ollama {
  return new Ollama({
    host: config.host,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });
}

export function mapOllamaError(err: any, config: OllamaConfig): AppError {
  if (err instanceof AppError) {
    return err;
  }

  const statusCode = Number(err?.status_code || err?.status || 0);
  const rawMsg = String(
    err?.error || err?.message || "Erro desconhecido na API do Ollama",
  );

  if (statusCode === 401 || statusCode === 403) {
    return new AppError(
      "OLLAMA_UNAUTHORIZED",
      "Chave de API do Ollama Cloud (OLLAMA_API_KEY) inválida ou não autorizada.",
      401,
      { upstream: rawMsg },
    );
  }

  if (statusCode === 402 || /usage credits|subscribe/i.test(rawMsg)) {
    return new AppError(
      "OLLAMA_CREDITS_REQUIRED",
      "Créditos insuficientes na conta Ollama Cloud. Adicione créditos ou assine um plano em https://ollama.com/plans.",
      402,
      { upstream: rawMsg },
    );
  }

  if (statusCode === 404 || /model .* not found/i.test(rawMsg)) {
    return new AppError(
      "OLLAMA_MODEL_NOT_FOUND",
      `Modelo '${config.model}' não encontrado no Ollama Cloud. Verifique OLLAMA_API_MODEL no .env.`,
      404,
      { upstream: rawMsg },
    );
  }

  if (statusCode === 429) {
    return new AppError(
      "OLLAMA_RATE_LIMIT",
      "Limite de requisições atingido no Ollama Cloud. Aguarde alguns instantes e tente novamente.",
      429,
      { upstream: rawMsg },
    );
  }

  return new AppError(
    "OLLAMA_UNAVAILABLE",
    `Não foi possível comunicar com o Ollama Cloud (${config.host}): ${rawMsg}`,
    502,
    { upstream: rawMsg },
  );
}

export async function runOllamaChat(
  messages: Message[],
  options?: Partial<Options>,
): Promise<string> {
  const config = resolveOllamaConfig();

  if (!config.apiKey) {
    throw new AppError(
      "OLLAMA_MISSING_API_KEY",
      "Variável OLLAMA_API_KEY não configurada para o Ollama Cloud.",
      401,
    );
  }

  const client = createOllamaClient(config);

  try {
    const response = await client.chat({
      model: config.model,
      messages,
      stream: false,
      ...(options ? { options } : {}),
    });

    return (response.message?.content || "").trim();
  } catch (err) {
    throw mapOllamaError(err, config);
  }
}

export async function checkOllamaHealth(): Promise<OllamaHealthResult> {
  const config = resolveOllamaConfig();

  if (!config.apiKey) {
    return {
      status: "missing_api_key",
      model: config.displayModel,
      resolvedModel: config.model,
      host: config.host,
      message: "OLLAMA_API_KEY ausente",
    };
  }

  try {
    const res = await fetch(`${config.host}/api/tags`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: AbortSignal.timeout(3500),
    });

    if (res.status === 401 || res.status === 403) {
      return {
        status: "unauthorized",
        model: config.displayModel,
        resolvedModel: config.model,
        host: config.host,
        message: "Chave de API inválida ou sem autorização",
      };
    }

    if (res.status === 402) {
      return {
        status: "credits_required",
        model: config.displayModel,
        resolvedModel: config.model,
        host: config.host,
        message: "Créditos insuficientes na conta Ollama Cloud",
      };
    }

    if (!res.ok) {
      return {
        status: "degraded",
        model: config.displayModel,
        resolvedModel: config.model,
        host: config.host,
        message: `HTTP ${res.status} ao consultar ${config.host}/api/tags`,
      };
    }

    const data: any = await res.json().catch(() => null);
    let modelWarning: string | undefined;

    if (Array.isArray(data?.models)) {
      const hasModel = data.models.some(
        (m: any) =>
          m?.name === config.model ||
          m?.model === config.model ||
          m?.name === config.displayModel ||
          m?.model === config.displayModel,
      );
      if (!hasModel) {
        modelWarning = `Modelo '${config.model}' não listado em /api/tags`;
      }
    }

    return {
      status: "connected",
      model: config.displayModel,
      resolvedModel: config.model,
      host: config.host,
      ...(modelWarning ? { message: modelWarning } : {}),
    };
  } catch (err: any) {
    return {
      status: "unreachable",
      model: config.displayModel,
      resolvedModel: config.model,
      host: config.host,
      message: err?.message || "Falha de conexão com o Ollama Cloud",
    };
  }
}
