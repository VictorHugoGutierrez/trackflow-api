import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("Variável de ambiente RESEND_API_KEY não definida.");
}

export const resend = new Resend(process.env.RESEND_API_KEY);
