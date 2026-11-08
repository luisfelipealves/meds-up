---
task: DEV-009
status: HUMAN_TESTING
branch: agent/integration-dev-009
worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-009
base_commit: 479db3c9a00b887dc8c82d40dec4793532c8c79d
reviewed_implementation_head: 2e6228b05039984db23b9677db4752e36f1d3423
review_record_commit: 9ef0565
review_record: .ai/reviews/DEV-009-independent-rereview.md
source_rereview_commit: 75ebcfd8df78f46adae69ce368098bd7792917c2
candidate_commit: 2e6228b05039984db23b9677db4752e36f1d3423
candidate_branch: agent/integration-dev-009
prepared_at: 2026-11-08T00:00:00Z
review_status: PASS
review_blocking_findings: 0
review_non_blocking_findings: 1
human_testing_handoff: .ai/development/handoffs/DEV-009-human-testing.md
merge_status: NOT_MERGED
push_status: NOT_PUSHED
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# Human testing handoff — DEV-009

## Produto e escopo

DEV-009 implementa a confirmação pré-claim de identidade mascarada para um
paciente autenticado: exibe somente iniciais e nome permitido de médico/clínica,
compara a data de nascimento no backend, impede enumeração, limita tentativas e
audita tentativas/resultados. O escopo é provider-neutral/local, com repositório
em memória e dados sintéticos.

Ficam fora deste candidato: associação da prescrição (DEV-010), UI/provedor de
autenticação, persistência durável, provider/OCR, deploy, produção e dados reais
de saúde. A confirmação não consome o token nem associa a prescrição; isso é a
fronteira posterior de DEV-010.

## Branches e commits candidatos

- Branch de integração: `agent/integration-dev-009`.
- Worktree isolado: `/home/felipe/projetos/meds-up-worktrees/integration-dev-009`.
- Base: `479db3c9a00b887dc8c82d40dec4793532c8c79d`.
- Head de implementação revisado: `2e6228b05039984db23b9677db4752e36f1d3423`.
- Rereview originado em `agent/rereview-dev-009`: `75ebcfd8df78f46adae69ce368098bd7792917c2`.
- Rereview cherry-picked nesta branch como `9ef0565` (`docs(DEV-009): record independent rereview`).
- Verificação: `2e6228b` é ancestral de `75ebcfd` e o commit cherry-picked altera somente review/task metadata.

## Validações reais já executadas

- Rereview independente: **PASS**, zero blockers, uma nota não bloqueadora N2.
- Testes focados: **37/37** — `node --test apps/backend/test/masked-identity-confirmation.test.mjs apps/backend/test/claim-token-lifecycle.test.mjs packages/contracts/test/contracts.test.mjs packages/contracts/test/schema.test.mjs`.
- `npm run validate:node`: **PASS** — backend 80/80, PWA 2/2, contracts 17/17, build, lint e foundation static check.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh`: **PASS** em todas as fases Node/Android/Wear registradas no integration handoff.
- `npm ci --ignore-scripts`: concluído, 0 vulnerabilidades reportadas.
- `git diff --check`: **PASS**.

## Review, remediação e rereview

- Review inicial: **FAIL**, com B1/B2 bloqueadores e N1 não bloqueador.
- Remediação: B1 unificou o envelope genérico `CLAIM_IDENTITY_FAILED`; B2
  fechou a projeção confiável e removeu nome completo da persistência; N1
  endureceu a validação Unicode do issuer.
- Rereview independente do head real `2e6228b`: **PASS**, zero blockers.
- N2 permanece não bloqueador: o serviço retorna o fragmento de dois campos,
  enquanto o contrato público versionado exige `apiVersion` e `schemaVersion`;
  um futuro adapter de transporte deve acrescentar/validar esses campos e
  DEV-010 não deve contornar essa fronteira.

## Passos manuais seguros

Execute somente no worktree acima, com Node local e dados sintéticos. Não use
credenciais, provedores, rede de aplicação, prescrições reais, nomes reais,
datas reais de pacientes ou qualquer dado clínico.

1. Confirme `git branch --show-current` = `agent/integration-dev-009` e
   `git rev-parse HEAD` = o commit de workflow atual; não faça merge nem push.
2. Execute o comando de testes focados acima e confirme 37/37.
3. Inspecione o teste e confirme cobertura de sujeito paciente autenticado,
   sujeito forjado/médico, token inválido/expirado/revogado/consumido, DOB
   sintético incompatível, rate limit, auditoria, replay e ausência de nome
   completo/token/DOB nos snapshots e respostas.
4. Execute `npm run validate:node` e confirme PASS; opcionalmente execute
   `./scripts/validate.sh` com os `ANDROID_HOME`/`ANDROID_SDK_ROOT` locais
   acima, sem configurar provider ou credencial.
5. Verifique que o preview válido contém exatamente `initials` e
   `issuerDisplayName`, que falhas usam o mesmo resultado genérico e que o
   token permanece ativo após preview/confirm; use apenas fixtures sintéticas
   existentes nos testes.
6. Registre aprovação ou rejeição humana explicitamente. A aprovação autoriza
   somente o próximo passo do workflow; não autoriza merge, push, provider,
   credencial, produção, dados reais, nem resolve TD-001.

## TD-001 e limites

TD-001 permanece **OPEN**. Não houve seleção/conexão de provider, credencial,
rede, persistência de produção, deployment, ativação ou processamento de dados
reais de saúde. A implementação local/provider-neutral e seus testes sintéticos
continuam permitidos; não constituem aprovação de produção.

## Gate

`NOT MERGED — NOT PUSHED`. O candidato aguarda validação humana explícita.
