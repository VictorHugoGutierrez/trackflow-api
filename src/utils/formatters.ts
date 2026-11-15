export function calculateAmountCents(
  durationSeconds: number,
  hourlyRateCents: number,
): number {
  if (
    !Number.isFinite(durationSeconds) ||
    !Number.isFinite(hourlyRateCents) ||
    durationSeconds <= 0 ||
    hourlyRateCents <= 0
  ) {
    return 0;
  }
  return Math.round((durationSeconds * hourlyRateCents) / 3600);
}

export function parseReaisToCents(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const normalized = String(value).trim().replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

export function formatDurationHMS(seconds?: number | null): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDurationHuman(seconds?: number | null): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
}

export function formatCurrencyBRL(cents?: number | null): string {
  const reais = (Number(cents) || 0) / 100;
  return `R$ ${reais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
