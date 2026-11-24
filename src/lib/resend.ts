import { Resend } from "resend";
import { AppError } from "../errors/app-error.js";

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  frontendUrl: string;
}

export interface EmailDispatchEvent {
  id: string;
  type: "RESEND_EMAIL";
  routine: string;
  to: string;
  subject: string;
  status: "DELIVERED" | "ERROR";
  message: string;
  resendId: string | null;
  timestamp: string;
}

export interface SendSystemEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  routine: string;
  throwOnError?: boolean;
}

export interface SendSystemEmailResult {
  success: boolean;
  resendId: string | null;
  to: string;
  error?: {
    name?: string;
    message: string;
    statusCode?: number;
  };
}

export const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";

const MAX_EMAIL_EVENTS = 25;
const recentEmailEvents: EmailDispatchEvent[] = [];

function recordEmailEvent(event: EmailDispatchEvent): void {
  recentEmailEvents.unshift(event);
  if (recentEmailEvents.length > MAX_EMAIL_EVENTS) {
    recentEmailEvents.splice(MAX_EMAIL_EVENTS);
  }
}

export function getRecentEmailEvents(): EmailDispatchEvent[] {
  return recentEmailEvents.map((event) => ({ ...event }));
}

export function resolveResendConfig(): ResendConfig {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000")
    .trim()
    .replace(/\/+$/, "");

  return {
    apiKey,
    fromEmail,
    frontendUrl,
  };
}

export function createResendClient(apiKey?: string): Resend {
  const resolvedKey = (apiKey ?? resolveResendConfig().apiKey).trim();
  if (!resolvedKey) {
    throw new AppError(
      "CONFIG_ERROR",
      "Variável de ambiente RESEND_API_KEY não configurada.",
      500,
    );
  }
  return new Resend(resolvedKey);
}

export async function sendSystemEmail(
  options: SendSystemEmailOptions,
): Promise<SendSystemEmailResult> {
  const config = resolveResendConfig();
  const primaryTo = Array.isArray(options.to)
    ? options.to.join(", ")
    : options.to;
  const nowIso = new Date().toISOString();

  if (!config.apiKey) {
    const errMsg = "Variável de ambiente RESEND_API_KEY não configurada.";
    recordEmailEvent({
      id: `mail-err-${Date.now()}`,
      type: "RESEND_EMAIL",
      routine: options.routine,
      to: primaryTo,
      subject: options.subject,
      status: "ERROR",
      message: `[${options.routine}] Falha para ${primaryTo}: RESEND_API_KEY ausente`,
      resendId: null,
      timestamp: nowIso,
    });

    if (options.throwOnError) {
      throw new AppError("CONFIG_ERROR", errMsg, 500);
    }

    console.warn(`[Resend:${options.routine}] ${errMsg}`);
    return {
      success: false,
      resendId: null,
      to: primaryTo,
      error: { message: errMsg },
    };
  }

  try {
    const client = createResendClient(config.apiKey);
    const response = await client.emails.send({
      from: config.fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (response.error) {
      const errMsg =
        response.error.message || "Falha ao disparar o e-mail via Resend.";
      const errName = (response.error as { name?: string }).name;
      const errStatus = (response.error as { statusCode?: number }).statusCode;

      recordEmailEvent({
        id: `mail-err-${Date.now()}`,
        type: "RESEND_EMAIL",
        routine: options.routine,
        to: primaryTo,
        subject: options.subject,
        status: "ERROR",
        message: `[${options.routine}] Falha para ${primaryTo}: ${errMsg}`,
        resendId: null,
        timestamp: nowIso,
      });

      console.warn(
        `[Resend:${options.routine}] Falha ao enviar para ${primaryTo}: ${errMsg}`,
      );

      if (options.throwOnError) {
        throw new AppError(
          "EMAIL_SEND_FAILED",
          errMsg,
          400,
          response.error,
        );
      }

      return {
        success: false,
        resendId: null,
        to: primaryTo,
        error: {
          name: errName,
          message: errMsg,
          statusCode: errStatus,
        },
      };
    }

    const resendId = response.data?.id || null;

    recordEmailEvent({
      id: resendId ? `mail-${resendId.slice(0, 8)}` : `mail-${Date.now()}`,
      type: "RESEND_EMAIL",
      routine: options.routine,
      to: primaryTo,
      subject: options.subject,
      status: "DELIVERED",
      message: `[${options.routine}] Enviado para ${primaryTo} — "${options.subject}"`,
      resendId,
      timestamp: nowIso,
    });

    return {
      success: true,
      resendId,
      to: primaryTo,
    };
  } catch (err: any) {
    if (err instanceof AppError) {
      if (options.throwOnError) {
        throw err;
      }
      return {
        success: false,
        resendId: null,
        to: primaryTo,
        error: {
          message: err.message,
          statusCode: err.statusCode,
        },
      };
    }

    const errMsg = err?.message || "Erro inesperado no envio de e-mail.";
    recordEmailEvent({
      id: `mail-err-${Date.now()}`,
      type: "RESEND_EMAIL",
      routine: options.routine,
      to: primaryTo,
      subject: options.subject,
      status: "ERROR",
      message: `[${options.routine}] Erro para ${primaryTo}: ${errMsg}`,
      resendId: null,
      timestamp: nowIso,
    });

    console.warn(
      `[Resend:${options.routine}] Exceção ao enviar para ${primaryTo}: ${errMsg}`,
    );

    if (options.throwOnError) {
      throw new AppError("EMAIL_SEND_FAILED", errMsg, 502, err);
    }

    return {
      success: false,
      resendId: null,
      to: primaryTo,
      error: { message: errMsg },
    };
  }
}
