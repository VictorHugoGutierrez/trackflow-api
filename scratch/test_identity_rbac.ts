import { app } from "/mnt/c/Pessoal/trackflow-api/src/server";
import { prisma } from "/mnt/c/Pessoal/trackflow-api/src/lib/prisma";
import jwt from "jsonwebtoken";
import type { Server } from "http";

let server: Server;
const PORT = 3894;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runIdentityRbacTests() {
  console.log("=== INICIANDO TESTES DE IDENTIDADE, RBAC E AUTONOMIA OPERACIONAL DO OWNER ===");

  server = app.listen(PORT);
  const jwtSecret = process.env.JWT_SECRET!;

  const testOwnerEmail = `owner_saas_${Date.now()}@autonomia.test`;
  const testOwnerPass = "senha_owner_123";
  const testCompanyName = `Empresa Autonomia ${Date.now()}`;
  let provisionedTenantId = "";

  try {
    // 1. Testar Login do SUPER_ADMIN e verificar tenantId nulo
    console.log("\n[1] Testando login do SUPER_ADMIN (esperado tenantId nulo)...");
    const resLoginAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@trackflow.com",
        password: "Admin@123456",
      }),
    });
    const dataLoginAdmin = await resLoginAdmin.json();
    console.log(`Status login: ${resLoginAdmin.status} (esperado 200)`);
    console.log(`User role: ${dataLoginAdmin.data?.user?.role} (esperado SUPER_ADMIN)`);
    console.log(`Tenant retornado no login: ${dataLoginAdmin.data?.tenant} (esperado null)`);
    if (resLoginAdmin.status !== 200 || dataLoginAdmin.data?.user?.role !== "SUPER_ADMIN" || dataLoginAdmin.data?.tenant !== null) {
      throw new Error("Falha no login do Super Admin com tenant nulo");
    }

    const superAdminToken = dataLoginAdmin.data.token;
    const decodedToken = jwt.decode(superAdminToken) as any;
    console.log(`Claim tenantId no JWT: ${decodedToken.tenantId} (esperado null)`);
    if (decodedToken.tenantId !== null) throw new Error("JWT do Super Admin não possui tenantId nulo");

    // 2. Testar acesso do SUPER_ADMIN a rotas administrativas globais (/api/admin/*)
    console.log("\n[2] Testando acesso do SUPER_ADMIN a GET /api/admin/metrics...");
    const resAdminMetrics = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    console.log(`Status /api/admin/metrics: ${resAdminMetrics.status} (esperado 200)`);
    if (resAdminMetrics.status !== 200) throw new Error("Super Admin não conseguiu acessar /api/admin/metrics");

    // 3. Testar rejeição de token com role SUPER_ADMIN que possua tenantId preenchido (não nulo)
    console.log("\n[3] Testando rejeição em /api/admin/* de token SUPER_ADMIN com tenantId não-nulo...");
    const forgedToken = jwt.sign(
      { sub: "fake-id", tenantId: "tenant-nao-nulo", role: "SUPER_ADMIN", email: "forged@test.com" },
      jwtSecret,
      { expiresIn: "1h" },
    );
    const resForged = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    console.log(`Status com tenantId não-nulo: ${resForged.status} (esperado 403)`);
    if (resForged.status !== 403) throw new Error("Permitiu acesso admin a usuário com tenantId não nulo");

    // 4. Testar bloqueio de SUPER_ADMIN em rotas operacionais de tenant (sem tenant ativo)
    console.log("\n[4] Testando bloqueio de SUPER_ADMIN em rotas operacionais de tenant...");
    const resTimerAdmin = await fetch(`${BASE_URL}/api/time-entries/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ description: "Tentativa admin" }),
    });
    console.log(`Status timer sem tenant: ${resTimerAdmin.status} (esperado 400 - TENANT_REQUIRED)`);
    if (resTimerAdmin.status !== 400) throw new Error("Permitiu Super Admin iniciar timer sem tenant");

    // 5. Provisionamento Transacional do Tenant e Owner (POST /api/admin/tenants)
    console.log("\n[5] Testando provisionamento atômico (POST /api/admin/tenants)...");
    const resProvision = await fetch(`${BASE_URL}/api/admin/tenants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: testCompanyName,
        plan: "pro",
        ownerName: "Gestor Autônomo",
        ownerEmail: testOwnerEmail,
        ownerPassword: testOwnerPass,
      }),
    });
    const dataProvision = await resProvision.json();
    console.log(`Status provisionamento: ${resProvision.status} (esperado 201)`);
    console.log(`Tenant ID: ${dataProvision.data?.tenant?.id}, Plano: ${dataProvision.data?.tenant?.plan}`);
    console.log(`Owner ID: ${dataProvision.data?.owner?.id}, Role: ${dataProvision.data?.owner?.role}`);
    console.log(`Owner tenantId associado: ${dataProvision.data?.owner?.tenantId === dataProvision.data?.tenant?.id}`);
    if (resProvision.status !== 201) throw new Error("Falha no provisionamento");

    provisionedTenantId = dataProvision.data.tenant.id;

    // 6. Login do Owner recém-provisionado
    console.log("\n[6] Testando login do OWNER provisionado...");
    const resOwnerLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testOwnerEmail,
        password: testOwnerPass,
      }),
    });
    const dataOwnerLogin = await resOwnerLogin.json();
    console.log(`Status login owner: ${resOwnerLogin.status} (esperado 200)`);
    console.log(`Owner role: ${dataOwnerLogin.data?.user?.role} (esperado OWNER)`);
    console.log(`Tenant ID no login: ${dataOwnerLogin.data?.tenant?.id}`);
    const ownerToken = dataOwnerLogin.data?.token;

    // 7. Autonomia Operacional do OWNER: Criar Cliente, Projeto, Tarefa e Cronômetro
    console.log("\n[7] Testando Autonomia Operacional do OWNER...");
    
    // 7.1 Criar Cliente
    const resClient = await fetch(`${BASE_URL}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: "Cliente Alfa", contact: "alfa@cliente.com" }),
    });
    const dataClient = await resClient.json();
    console.log(`- Criar Cliente: Status ${resClient.status} (esperado 201) - ID: ${dataClient.data?.id}`);
    if (resClient.status !== 201) throw new Error("Owner não conseguiu criar cliente");

    // 7.2 Criar Projeto
    const resProject = await fetch(`${BASE_URL}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: "Projeto SaaS", clientId: dataClient.data.id, budgetHours: 40 }),
    });
    const dataProject = await resProject.json();
    console.log(`- Criar Projeto: Status ${resProject.status} (esperado 201) - ID: ${dataProject.data?.id}`);
    if (resProject.status !== 201) throw new Error("Owner não conseguiu criar projeto");

    // 7.3 Criar Tarefa
    const resTask = await fetch(`${BASE_URL}/api/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ projectId: dataProject.data.id, title: "Desenvolver Funcionalidade" }),
    });
    const dataTask = await resTask.json();
    console.log(`- Criar Tarefa: Status ${resTask.status} (esperado 201) - ID: ${dataTask.data?.id}`);
    if (resTask.status !== 201) throw new Error("Owner não conseguiu criar tarefa");

    // 7.4 Iniciar Cronômetro (Timer)
    const resTimerStart = await fetch(`${BASE_URL}/api/time-entries/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        projectId: dataProject.data.id,
        taskId: dataTask.data.id,
        description: "Trabalhando no módulo principal",
      }),
    });
    const dataTimerStart = await resTimerStart.json();
    console.log(`- Iniciar Timer: Status ${resTimerStart.status} (esperado 201) - Entry ID: ${dataTimerStart.data?.id}`);
    if (resTimerStart.status !== 201) throw new Error("Owner não conseguiu iniciar timer");

    // 7.5 Parar Cronômetro (Timer)
    const resTimerStop = await fetch(`${BASE_URL}/api/time-entries/${dataTimerStart.data.id}/stop`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ description: "Finalizado módulo principal" }),
    });
    const dataTimerStop = await resTimerStop.json();
    console.log(`- Parar Timer: Status ${resTimerStop.status} (esperado 200) - Duração: ${dataTimerStop.data?.duration}s`);
    if (resTimerStop.status !== 200) throw new Error("Owner não conseguiu parar timer");

    // 7.6 Gestão de Equipe pelo OWNER
    const resTeamInvite = await fetch(`${BASE_URL}/api/team/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: "Desenvolvedor Equipe",
        email: `dev_${Date.now()}@autonomia.test`,
        password: "senha_dev_123",
        role: "MEMBER",
      }),
    });
    const dataTeamInvite = await resTeamInvite.json();
    console.log(`- Convidar Membro: Status ${resTeamInvite.status} (esperado 201) - ID: ${dataTeamInvite.data?.id}`);
    if (resTeamInvite.status !== 201) throw new Error("Owner não conseguiu convidar membro");

    // 8. Limpeza: Excluir tenant via Control Plane
    console.log("\n[8] Limpeza: Excluindo tenant provisionado e todos os recursos associados...");
    const resDeleteTenant = await fetch(`${BASE_URL}/api/admin/tenants/${provisionedTenantId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    console.log(`Status exclusão: ${resDeleteTenant.status} (esperado 200)`);
    if (resDeleteTenant.status !== 200) throw new Error("Falha ao excluir tenant na limpeza");

    console.log("\n✅ TODOS OS TESTES DE IDENTIDADE, RBAC E AUTONOMIA OPERACIONAL FORAM APROVADOS COM SUCESSO!");
  } finally {
    try {
      if (provisionedTenantId) {
        await prisma.tenant.deleteMany({ where: { id: provisionedTenantId } });
      }
    } catch {}

    await prisma.$disconnect();
    server.close();
    process.exit(0);
  }
}

runIdentityRbacTests().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
