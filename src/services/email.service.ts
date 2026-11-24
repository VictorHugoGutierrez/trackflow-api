import {
  resolveResendConfig,
  sendSystemEmail,
  type SendSystemEmailResult,
} from "../lib/resend.js";
import { formatCurrencyBRL, formatDurationHMS } from "../utils/formatters.js";

export interface TrackFlowEmailLayoutParams {
  title: string;
  subtitleHtml: string;
  badgeText: string;
  metaRightHtml?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerText?: string;
}

export interface InvoiceEmailParams {
  invoiceId?: string;
  tenantName: string;
  clientName: string;
  monthRef: string;
  durationSeconds: number;
  amountCents: number;
  status: string;
  aiSummary?: string | null;
}

export interface PasswordRecoveryEmailParams {
  userName: string;
  userEmail: string;
  temporaryPassword: string;
  loginUrl?: string;
}

export interface TeamInviteEmailParams {
  memberName: string;
  memberEmail: string;
  temporaryPassword: string;
  tenantName: string;
  role: string;
  invitedByName?: string;
  loginUrl?: string;
}

export interface TenantProvisionedEmailParams {
  ownerName: string;
  ownerEmail: string;
  temporaryPassword: string;
  tenantName: string;
  plan: string;
  loginUrl?: string;
}

export interface WelcomeRegisterEmailParams {
  userName: string;
  userEmail: string;
  tenantName: string;
  plan: string;
  dashboardUrl?: string;
}

export interface PasswordChangedEmailParams {
  userName: string;
  userEmail: string;
  changedAt?: Date;
  loginUrl?: string;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildKeyValueTableHtml(
  rows: Array<{ label: string; value: string; highlight?: boolean }>,
): string {
  const rowsHtml = rows
    .map(
      (row) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; width: 38%;">${escapeHtml(row.label)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: bold; color: ${row.highlight ? "#047857" : "#0f172a"};">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join("");

  return `
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0 24px;">
      <thead>
        <tr style="background: #f1f5f9; text-align: left;">
          <th style="padding: 10px 12px; font-size: 12px; color: #475569; border-bottom: 1px solid #cbd5e1; text-transform: uppercase;">Detalhe</th>
          <th style="padding: 10px 12px; font-size: 12px; color: #475569; border-bottom: 1px solid #cbd5e1; text-transform: uppercase;">Informação</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}
      </tbody>
    </table>`;
}

function buildTemporaryPasswordBoxHtml(params: {
  label: string;
  temporaryPassword: string;
  note: string;
}): string {
  return `
    <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin: 20px 0 24px;">
      <p style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">${escapeHtml(params.label)}</p>
      <div style="margin: 4px 0 12px;">
        <span style="font-family: 'Courier New', Courier, monospace; font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #047857; background: #ecfdf5; padding: 8px 14px; border-radius: 6px; display: inline-block; border: 1px solid #a7f3d0;">${escapeHtml(params.temporaryPassword)}</span>
      </div>
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #334155;">${escapeHtml(params.note)}</p>
    </div>`;
}

function formatRoleLabel(role: string): string {
  const normalized = role.trim().toUpperCase();
  if (normalized === "OWNER") return "Proprietário (Owner)";
  if (normalized === "MANAGER") return "Gestor (Manager)";
  if (normalized === "MEMBER") return "Colaborador (Member)";
  return role;
}

function formatPlanLabel(plan: string): string {
  const normalized = plan.trim().toLowerCase();
  if (normalized === "pro") return "Pro";
  if (normalized === "enterprise") return "Enterprise";
  if (normalized === "freemium") return "Freemium";
  return plan;
}

export function buildTrackFlowEmailLayout(
  params: TrackFlowEmailLayoutParams,
): string {
  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `<div style="margin: 28px 0 8px; text-align: center;">
          <a href="${escapeHtml(params.ctaUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 8px;">${escapeHtml(params.ctaLabel)}</a>
        </div>`
      : "";

  const footerText =
    params.footerText ||
    "Mensagem automática enviada pela plataforma TrackFlow SaaS.";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; color: #1e293b; max-width: 680px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
  <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #10b981; margin-bottom: 24px;">
      <tr>
        <td style="padding-bottom: 16px; vertical-align: top;">
          <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: bold;">TrackFlow</h1>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">${params.subtitleHtml}</p>
        </td>
        <td style="padding-bottom: 16px; text-align: right; vertical-align: top;">
          <span style="display: inline-block; background: #ecfdf5; color: #047857; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">${escapeHtml(params.badgeText)}</span>
          ${params.metaRightHtml || ""}
        </td>
      </tr>
    </table>

    ${params.bodyHtml}
    ${ctaHtml}

    <p style="margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
      ${escapeHtml(footerText)}
    </p>
  </div>
</body>
</html>`;
}

export function buildInvoiceEmailHtml(params: InvoiceEmailParams): string {
  const formattedHours = formatDurationHMS(params.durationSeconds);
  const formattedValue = formatCurrencyBRL(params.amountCents);
  const escapedSummary = params.aiSummary
    ? escapeHtml(params.aiSummary).replace(/\n/g, "<br/>")
    : "";

  const bodyHtml = `
    <div style="margin-bottom: 24px;">
      <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase;">Cliente</p>
      <h2 style="margin: 0; color: #0f172a; font-size: 18px;">${escapeHtml(params.clientName)}</h2>
    </div>

    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #f1f5f9; text-align: left;">
          <th style="padding: 12px; font-size: 13px; color: #475569; border-bottom: 1px solid #cbd5e1;">Descrição</th>
          <th style="padding: 12px; font-size: 13px; color: #475569; border-bottom: 1px solid #cbd5e1; text-align: right;">Tempo Apurado</th>
          <th style="padding: 12px; font-size: 13px; color: #475569; border-bottom: 1px solid #cbd5e1; text-align: right;">Valor Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">Prestação de Serviços (${escapeHtml(params.monthRef)})</td>
          <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: right; font-weight: bold;">${escapeHtml(formattedHours)}</td>
          <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; font-size: 16px; text-align: right; font-weight: bold; color: #047857;">${escapeHtml(formattedValue)}</td>
        </tr>
      </tbody>
    </table>

    ${
      escapedSummary
        ? `<div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 8px; font-size: 14px; color: #0f172a;">Resumo Executivo das Entregas (IA)</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #334155;">${escapedSummary}</p>
          </div>`
        : ""
    }`;

  return buildTrackFlowEmailLayout({
    title: `Fatura TrackFlow - ${params.monthRef}`,
    subtitleHtml: `Emitido por: <strong>${escapeHtml(params.tenantName)}</strong>`,
    badgeText: params.status,
    metaRightHtml: `<p style="margin: 8px 0 0; color: #64748b; font-size: 13px;">Ref: <strong>${escapeHtml(params.monthRef)}</strong></p>`,
    bodyHtml,
    footerText: "Documento gerado automaticamente pela plataforma TrackFlow SaaS.",
  });
}

export async function sendInvoiceEmail(
  params: InvoiceEmailParams & {
    to: string;
    subject?: string;
    throwOnError?: boolean;
  },
): Promise<SendSystemEmailResult> {
  const html = buildInvoiceEmailHtml(params);
  const subject =
    params.subject ||
    `Fatura TrackFlow (${params.monthRef}) - ${params.clientName}`;

  return sendSystemEmail({
    to: params.to,
    subject,
    html,
    routine: "INVOICE",
    throwOnError: params.throwOnError ?? true,
  });
}

export function buildPasswordRecoveryEmailHtml(
  params: PasswordRecoveryEmailParams,
): string {
  const loginUrl =
    params.loginUrl || `${resolveResendConfig().frontendUrl}/login`;

  const bodyHtml = `
    <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #1e293b;">
      Olá, <strong>${escapeHtml(params.userName)}</strong>,
    </p>
    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">
      Recebemos uma solicitação de recuperação de senha para a conta associada ao e-mail
      <strong>${escapeHtml(params.userEmail)}</strong>.
    </p>
    ${buildTemporaryPasswordBoxHtml({
      label: "Sua Senha Temporária",
      temporaryPassword: params.temporaryPassword,
      note: "Por segurança, ao realizar o login com esta credencial, será obrigatória a definição de uma nova senha pessoal.",
    })}
    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
      Se você não solicitou esta alteração, acesse sua conta imediatamente e atualize sua senha ou informe o administrador do seu workspace.
    </p>`;

  return buildTrackFlowEmailLayout({
    title: "Recuperação de Senha - TrackFlow",
    subtitleHtml: "Segurança &amp; Controle de Acesso",
    badgeText: "Recuperação de Senha",
    bodyHtml,
    ctaLabel: "Acessar TrackFlow",
    ctaUrl: loginUrl,
  });
}

export async function sendPasswordRecoveryEmail(
  params: PasswordRecoveryEmailParams,
): Promise<SendSystemEmailResult> {
  const html = buildPasswordRecoveryEmailHtml(params);
  return sendSystemEmail({
    to: params.userEmail,
    subject: "Recuperação de Senha - TrackFlow",
    html,
    routine: "FORGOT_PASSWORD",
    throwOnError: false,
  });
}

export function buildTeamInviteEmailHtml(params: TeamInviteEmailParams): string {
  const loginUrl =
    params.loginUrl || `${resolveResendConfig().frontendUrl}/login`;
  const invitedBySentence = params.invitedByName
    ? ` por <strong>${escapeHtml(params.invitedByName)}</strong>`
    : "";

  const bodyHtml = `
    <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #1e293b;">
      Olá, <strong>${escapeHtml(params.memberName)}</strong>!
    </p>
    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">
      Você foi convidado${invitedBySentence} para integrar a equipe do workspace
      <strong>${escapeHtml(params.tenantName)}</strong> no TrackFlow.
    </p>
    ${buildKeyValueTableHtml([
      { label: "Workspace", value: params.tenantName },
      { label: "Nível de Acesso", value: formatRoleLabel(params.role), highlight: true },
      { label: "E-mail de Login", value: params.memberEmail },
    ])}
    ${buildTemporaryPasswordBoxHtml({
      label: "Senha Inicial Temporária",
      temporaryPassword: params.temporaryPassword,
      note: "No primeiro acesso você será direcionado automaticamente para criar sua senha definitiva.",
    })}`;

  return buildTrackFlowEmailLayout({
    title: `Convite para o workspace ${params.tenantName} - TrackFlow`,
    subtitleHtml: `Workspace: <strong>${escapeHtml(params.tenantName)}</strong>`,
    badgeText: "Convite de Equipe",
    bodyHtml,
    ctaLabel: "Acessar Workspace",
    ctaUrl: loginUrl,
  });
}

export async function sendTeamInviteEmail(
  params: TeamInviteEmailParams,
): Promise<SendSystemEmailResult> {
  const html = buildTeamInviteEmailHtml(params);
  return sendSystemEmail({
    to: params.memberEmail,
    subject: `Convite para o workspace ${params.tenantName} - TrackFlow`,
    html,
    routine: "TEAM_INVITE",
    throwOnError: false,
  });
}

export function buildTenantProvisionedEmailHtml(
  params: TenantProvisionedEmailParams,
): string {
  const loginUrl =
    params.loginUrl || `${resolveResendConfig().frontendUrl}/login`;
  const planDisplay = formatPlanLabel(params.plan);

  const bodyHtml = `
    <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #1e293b;">
      Olá, <strong>${escapeHtml(params.ownerName)}</strong>,
    </p>
    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">
      O ambiente corporativo da organização <strong>${escapeHtml(params.tenantName)}</strong> foi provisionado com sucesso no TrackFlow e você foi definido como administrador responsável.
    </p>
    ${buildKeyValueTableHtml([
      { label: "Empresa / Workspace", value: params.tenantName },
      { label: "Plano Ativo", value: planDisplay, highlight: true },
      { label: "Administrador (Owner)", value: params.ownerEmail },
    ])}
    ${buildTemporaryPasswordBoxHtml({
      label: "Senha Inicial Temporária",
      temporaryPassword: params.temporaryPassword,
      note: "Por política de segurança, você deverá alterar esta senha temporária no primeiro acesso antes de utilizar o painel.",
    })}`;

  return buildTrackFlowEmailLayout({
    title: `Seu workspace ${params.tenantName} foi criado no TrackFlow`,
    subtitleHtml: `Organização: <strong>${escapeHtml(params.tenantName)}</strong>`,
    badgeText: `Plano ${planDisplay}`,
    bodyHtml,
    ctaLabel: "Iniciar no TrackFlow",
    ctaUrl: loginUrl,
  });
}

export async function sendTenantProvisionedEmail(
  params: TenantProvisionedEmailParams,
): Promise<SendSystemEmailResult> {
  const html = buildTenantProvisionedEmailHtml(params);
  return sendSystemEmail({
    to: params.ownerEmail,
    subject: `Seu workspace ${params.tenantName} foi criado no TrackFlow`,
    html,
    routine: "TENANT_PROVISION",
    throwOnError: false,
  });
}

export function buildWelcomeRegisterEmailHtml(
  params: WelcomeRegisterEmailParams,
): string {
  const dashboardUrl =
    params.dashboardUrl || `${resolveResendConfig().frontendUrl}/dashboard`;
  const planDisplay = formatPlanLabel(params.plan);

  const bodyHtml = `
    <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #1e293b;">
      Bem-vindo ao TrackFlow, <strong>${escapeHtml(params.userName)}</strong>!
    </p>
    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">
      Sua conta e seu workspace foram configurados com sucesso. A partir de agora você já pode gerenciar clientes, projetos, apontamentos de horas e faturamento automatizado.
    </p>
    ${buildKeyValueTableHtml([
      { label: "Workspace", value: params.tenantName },
      { label: "E-mail", value: params.userEmail },
      { label: "Plano Inicial", value: planDisplay, highlight: true },
    ])}
    <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 8px; font-size: 14px; color: #0f172a;">Primeiros Passos Recomendados</h3>
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #334155;">
        1. Cadastre seus clientes e projetos ativos.<br/>
        2. Utilize o cronômetro ou lançamentos manuais para registrar as horas.<br/>
        3. Emita faturas mensais com resumo executivo gerado por IA e envio direto por e-mail.
      </p>
    </div>`;

  return buildTrackFlowEmailLayout({
    title: `Bem-vindo ao TrackFlow, ${params.userName}!`,
    subtitleHtml: `Workspace: <strong>${escapeHtml(params.tenantName)}</strong>`,
    badgeText: "Boas-vindas",
    bodyHtml,
    ctaLabel: "Acessar Painel TrackFlow",
    ctaUrl: dashboardUrl,
  });
}

export async function sendWelcomeRegisterEmail(
  params: WelcomeRegisterEmailParams,
): Promise<SendSystemEmailResult> {
  const html = buildWelcomeRegisterEmailHtml(params);
  return sendSystemEmail({
    to: params.userEmail,
    subject: `Bem-vindo ao TrackFlow, ${params.userName}!`,
    html,
    routine: "WELCOME_REGISTER",
    throwOnError: false,
  });
}

export function buildPasswordChangedEmailHtml(
  params: PasswordChangedEmailParams,
): string {
  const loginUrl =
    params.loginUrl || `${resolveResendConfig().frontendUrl}/login`;
  const formattedDate = (params.changedAt || new Date()).toLocaleString(
    "pt-BR",
    {
      timeZone: "America/Sao_Paulo",
    },
  );

  const bodyHtml = `
    <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #1e293b;">
      Olá, <strong>${escapeHtml(params.userName)}</strong>,
    </p>
    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">
      Confirmamos que a senha da sua conta TrackFlow (<strong>${escapeHtml(params.userEmail)}</strong>) foi atualizada com sucesso.
    </p>
    ${buildKeyValueTableHtml([
      { label: "Conta", value: params.userEmail },
      { label: "Data e Hora (BRT)", value: formattedDate, highlight: true },
    ])}
    <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 6px; font-size: 14px; color: #0f172a;">Aviso de Segurança</h3>
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #334155;">
        Caso você não reconheça esta alteração, utilize imediatamente a opção de recuperação de senha na tela de login ou contate o administrador do seu workspace.
      </p>
    </div>`;

  return buildTrackFlowEmailLayout({
    title: "Aviso de Segurança: Senha alterada - TrackFlow",
    subtitleHtml: "Segurança &amp; Controle de Acesso",
    badgeText: "Senha Atualizada",
    bodyHtml,
    ctaLabel: "Acessar Minha Conta",
    ctaUrl: loginUrl,
  });
}

export async function sendPasswordChangedEmail(
  params: PasswordChangedEmailParams,
): Promise<SendSystemEmailResult> {
  const html = buildPasswordChangedEmailHtml(params);
  return sendSystemEmail({
    to: params.userEmail,
    subject: "Aviso de Segurança: Senha alterada - TrackFlow",
    html,
    routine: "PASSWORD_CHANGED",
    throwOnError: false,
  });
}
