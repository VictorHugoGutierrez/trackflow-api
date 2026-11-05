import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { TeamModel } from "../models/team.model.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../errors/app-error.js";

export class TeamController {
  static async listMembers(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const members = await TeamModel.listMembers(tenantId);

    if (req.path.startsWith("/dashboard") && req.accepts("html")) {
      return res.render("dashboard/team", {
        user: req.user,
        members,
      });
    }

    return res.status(200).json({
      success: true,
      data: members,
    });
  }

  static async inviteMember(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const { name, email, password, role } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      throw new AppError("VALIDATION_ERROR", "O campo 'name' é obrigatório.", 400);
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      throw new AppError("VALIDATION_ERROR", "O campo 'email' é obrigatório.", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      throw new AppError("VALIDATION_ERROR", "Formato de e-mail inválido.", 400);
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      throw new AppError("VALIDATION_ERROR", "A senha deve conter no mínimo 6 caracteres.", 400);
    }

    const uppercaseRole = typeof role === "string" ? role.toUpperCase().trim() : "";
    if (uppercaseRole !== "MANAGER" && uppercaseRole !== "MEMBER") {
      throw new AppError(
        "INVALID_ROLE",
        "Apenas as funções 'MANAGER' ou 'MEMBER' podem ser atribuídas a novos membros.",
        400,
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new AppError("EMAIL_ALREADY_EXISTS", "Já existe um usuário cadastrado com este e-mail.", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await TeamModel.createMember({
      tenantId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: uppercaseRole as Role,
    });

    if (req.path.startsWith("/dashboard") && req.accepts("html")) {
      return res.redirect("/dashboard/team");
    }

    return res.status(201).json({
      success: true,
      data: result.user,
    });
  }

  static async removeMember(req: Request, res: Response) {
    const tenantId = req.user!.tenantId as string;
    const id = req.params.id as string;

    const targetUser = await TeamModel.findMemberById(id, tenantId);
    if (!targetUser) {
      throw new AppError("NOT_FOUND", "Membro não encontrado neste workspace.", 404);
    }

    if (targetUser.role === Role.OWNER) {
      throw new AppError("FORBIDDEN", "O proprietário (OWNER) do workspace não pode ser removido.", 403);
    }

    if (targetUser.id === req.user!.sub) {
      throw new AppError("BAD_REQUEST", "Você não pode remover a si mesmo da equipe.", 400);
    }

    if (req.user!.role === Role.MANAGER && targetUser.role === Role.MANAGER) {
      throw new AppError("FORBIDDEN", "Gestores não possuem permissão para remover outros gestores.", 403);
    }

    await TeamModel.deleteMember(id);

    if (req.path.startsWith("/dashboard") && req.accepts("html")) {
      return res.redirect("/dashboard/team");
    }

    return res.status(200).json({
      success: true,
      data: {
        message: "Membro removido da equipe com sucesso.",
      },
    });
  }
}
