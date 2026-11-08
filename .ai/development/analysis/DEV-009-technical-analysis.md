---
id: DEV-009
type: technical-analysis
status: GO
decision: GO
depends_on: [DEV-008]
reviewed_ref: origin/main
reviewed_commit: 479db3c9a00b887dc8c82d40dec4793532c8c79d
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
created_at: 2026-11-08
---

# DEV-009 — Technical analysis

## Conclusion

**GO técnico, restrito ao escopo provider-neutral/local de DEV-009.** A
dependência DEV-008 é elegível no estado efetivamente revisado: `origin/main`
já contém a implementação integrada, os testes, a remediação e o rereview
independente aprovado. O `main` do checkout raiz (`/home/felipe/projetos/meds-up`)
está atrás em `c464d2a`; esse atraso não representa o conteúdo de
`origin/main` usado nesta análise.

`HUMAN_TESTING` satisfaz a dependência técnica para iniciar DEV-009 porque o
artefato de handoff é acompanhado de integração, validação e rereview PASS e a
mesma cadeia está alcançável em `origin/main`. Isso não equivale a aprovação
humana de merge/produção: o handoff de DEV-008 ainda diz `NOT_MERGED —
NOT_PUSHED`, e TD-001 permanece `OPEN`. Nenhuma operação com dados reais,
provider, credencial, deployment ou arquitetura de produção é autorizada por
este GO.

## Evidência da elegibilidade

- `git merge-base HEAD origin/main` e `git rev-parse` apontam ambos para
  `479db3c`; o worktree desta análise está alinhado com `origin/main`.
- `git diff main..origin/main` mostra os dez caminhos de DEV-008, incluindo
  `apps/backend/src/claims/claim-token-lifecycle.mjs`, seu teste, export do
  backend e os registros de integração/review.
- `origin/main:.ai/development/tasks/DEV-008-implement-claim-token-lifecycle.md`
  registra `status: HUMAN_TESTING`, `review_status: PASS`, zero findings
  bloqueadores, remediação B1 concluída e rereview em `dd8b86a`.
- `.ai/reviews/DEV-008-independent-rereview.md` dá `PASS`, zero bloqueadores e
  aceita N1 como não bloqueador: a concorrência testada é serializada pelo
  repositório in-memory; um adapter durável futuro deverá fornecer atomicidade
  equivalente.
- O handoff de DEV-008 registra 10/10 testes focados, 70/70 testes Node,
  lint/build e validação completa como aprovados, mas mantém explicitamente
  fora de escopo identidade mascarada, DOB, associação, UI, adapters duráveis,
  providers e dados reais.

## Base técnica observada

### DEV-008 e interfaces que DEV-009 deve preservar

`createClaimTokenService` usa `createRoleGuard` com sujeitos autenticados e
confiáveis, exige autoridade injetada `authorizePrescriptionOwnership`, e
expõe `issue`, `getControl`, `listControls`, `revoke`, `replace` e `consume`
(`apps/backend/src/claims/claim-token-lifecycle.mjs:78-211`). O token bruto só
é devolvido como `qrPayload`; o repositório guarda apenas `tokenDigest` e
metadados de ciclo de vida. `consume` aceita somente paciente autenticado,
audita a tentativa antes da transição e devolve apenas
`claimTokenId`/`prescriptionId` em caso de sucesso.

O repositório in-memory mantém índice por digest, auditoria e transição
rollback-capable no mesmo limite síncrono (`...claim-token-lifecycle.mjs:213-371`).
Erros de token inválido, expirado, revogado, substituído, consumido ou limitado
são indistinguíveis externamente via `CONFLICT`/mensagem genérica. O limite
atual é injetável, por padrão 5 falhas em 15 minutos, por sujeito paciente
confiável; a janela, isolamento por paciente, auditoria e fronteira exata têm
testes.

O contrato existente de backend é Node ES modules, com dependências inward em
`@medsup/contracts`; a arquitetura exige portas explícitas e adapters
substituíveis (`docs/architecture/README.md`). Não adicionar SDK, tipo de
provider, persistência ou framework de cliente ao domínio.

### Identidade, autorização e autenticação

`createRoleGuard` primeiro chama a autoridade de autenticação e só então
valida o papel (`apps/backend/src/identity/subject.mjs:6-17`). O teste de
identidade rejeita sujeitos forjados e sujeitos emitidos por outra autoridade;
isso deve ser aplicado tanto ao preview quanto à confirmação. Não aceitar
`subjectId`, papel, nome, DOB ou autoridade vindos do QR, URL ou payload do
cliente como fonte de verdade.

O `SessionManager` fornece expiração/revogação de sessão e dispositivo, mas
não é um provider de identidade. DEV-009 deve receber apenas o sujeito já
validado pela composição de autenticação; a escolha do provider e o fluxo de
criação/recuperação de conta permanecem fora de escopo.

### Prescrição e dados disponíveis

`ConfirmedPrescription` contém ownership, status, versões e associação nula,
mas não contém DOB, iniciais, nome de clínica ou nome de médico. O conteúdo
clínico fica em `PrescriptionVersion` e não pode atravessar o ecrã pré-claim
(`apps/backend/src/prescriptions/prescription-confirmation.mjs:114-150`,
`packages/contracts/src/index.mjs:111-190`). O repository atual é owner-scoped
para médico e a autorização não pode ser derivada do request.

Portanto, o trabalho precisa de uma porta provider-neutral de identidade do
claim/prescrição, com uma projeção mínima interna que permita obter somente:

- iniciais já mascaradas ou dados mínimos suficientes para uma única função de
  masking no backend;
- nome display do médico/clínica, previamente allow-listed;
- DOB canônica da prescrição e o identificador opaco do claim;
- nenhuma medication, dose, diagnóstico, instrução, documento, OCR, versão
  clínica, email, telefone, endereço ou credencial.

Não existe hoje schema público para esse preview, DOB ou auditoria de claim.
O contrato deve ser fechado (`additionalProperties: false`), versionado e
aditivo conforme ADR-0003 antes de expor uma API.

### Observabilidade e auditoria

O logger atual aceita somente eventos/campos allow-listed de ingestão/OCR e
autenticação (`apps/backend/src/observability/structured-logger.mjs`); não é
uma autorização para colocar DOB, iniciais, clínica, token ou digest em logs.
O audit de DEV-008 é interno ao repositório e não contém token bruto/digest.
DEV-009 deve registrar separadamente, em estrutura bounded e access-controlled,
cada preview/confirmation attempt e seu resultado, inclusive token inválido,
DOB mismatch, rate-limited, sucesso e falha interna. O registro deve conter
somente IDs opacos, papel/ator confiável, tipo de operação, outcome allow-listed,
timestamp, correlation/attempt ID e referências internas; nunca DOB fornecida,
iniciais, nome, clínica, token, digest ou conteúdo clínico.

## Plano técnico estreito

1. **Definir o contrato interno e público mínimo.** Criar uma porta
   `ClaimIdentityProjection`/equivalente provider-neutral e validadores para
   preview, confirmação e audit. A saída de preview será estritamente
   `{initials, issuerDisplayName}` (mais versão/IDs opacos se necessários),
   sem `prescriptionId` se ele não for necessário ao cliente. DOB aceita uma
   representação canônica de data civil (`YYYY-MM-DD`), sem conversão de
   timezone; a resposta não ecoa a data.

2. **Implementar o masking no backend.** Se a fonte entrega nome, derivar
   iniciais uma vez no boundary confiável, com regras determinísticas para
   nomes de uma/múltiplas partes, sem armazenar nem devolver o nome completo.
   Rejeitar ou normalizar explicitamente entradas ambíguas; não fazer masking
   no cliente. O emissor deve ser um display name allow-listed, não um campo
   arbitrário do QR/request.

3. **Separar preview de confirmação e impedir enumeração.** Exigir sujeito
   paciente autenticado antes de qualquer resultado. Para token ausente,
   malformado, desconhecido, expirado, revogado, substituído ou consumido,
   retornar o mesmo erro genérico e a mesma forma externa; não devolver
   iniciais, emissor, status, motivo ou existência. Para token válido, devolver
   apenas a projeção mascarada permitida. Não criar endpoint de lookup por
   `prescriptionId`/DOB.

4. **Comparar DOB no backend.** Buscar o valor de referência pela porta
   confiável, comparar a data canônica fornecida sem confiar em dados do
   cliente, e não logar nem incluir valores em erros/telemetria. Mismatch deve
   produzir exatamente o mesmo resultado genérico de claim inválido; o
   outcome detalhado fica apenas no audit protegido.

5. **Aplicar limite e transação no boundary correto.** Rate-limitar falhas de
   confirmação por sujeito autenticado, com política injetável e janela
   testável, mantendo isolamento por paciente. A confirmação bem-sucedida deve
   emitir apenas uma capacidade/resultado interno não forjável para o próximo
   passo. Não chamar `consume` antes de DOB confirmada. A associação paciente-
   prescrição e o consume definitivo devem continuar coordenados na transação
   durável de DEV-010; DEV-009 não deve inventar uma associação parcial nem
   enfraquecer o limite atômico de DEV-008.

6. **Preservar failure semantics e fronteira de segredo.** Reutilizar o
   envelope content-free do backend para a superfície externa. Não colocar
   token bruto, digest, DOB, nome, iniciais, clínica ou prescrição em URL,
   QR, logs, traces, métricas, analytics, erros, snapshots de teste ou
   objetos de comando persistíveis. O único retorno permitido do segredo do
   QR continua sendo `qrPayload` no caminho de emissão de DEV-008.

## Riscos e limites aceitos

- A implementação atual é in-memory e síncrona. Isso é aceitável para o
  trabalho local/provider-neutral, mas não prova a concorrência de um adapter
  durável; o adapter futuro deve atomizar lookup, rate-limit, audit,
  confirmação e consumo/associação conforme o limite transacional aplicável.
- `ERROR_CODES` e o schema de contratos não têm categoria específica de claim;
  uma extensão deve conservar respostas externas genéricas e não transformar
  outcomes internos em enumeração.
- O modelo atual não define a fonte autoritativa para nome/DOB do paciente ou
  emissor. Essa porta é uma dependência técnica de DEV-009; ela não autoriza
  escolher IdP, banco, cloud, KMS, região ou provider.
- O logger existente não deve ser ampliado com campos de identidade. Auditoria
  de claim precisa de um contrato mínimo separado e controles de acesso/
  retenção compatíveis com dados sensíveis; a política definitiva de retenção
  continua nas decisões posteriores.
- A criação de conta/autenticação confiável é pré-condição de fluxo, mas o
  provider e a UX completa estão fora de DEV-009.

## Critérios de validação

### Contrato e comportamento

- Validadores rejeitam campos desconhecidos e qualquer campo clínico,
  identificador direto, URL, token ou dado de provider no preview/confirmation.
- Preview autenticado de token válido contém somente iniciais e emissor; não
  contém medicamento, dose, diagnóstico, instruções, DOB ou nome completo.
- DOB correta permite um resultado interno de confirmação; DOB incorreta não
  permite consumo/associação e retorna o erro genérico.
- Token inválido em todas as variantes, e DOB mismatch, produzem o mesmo
  envelope externo e não revelam existência, estado ou identidade.

### Segurança e autorização

- Sujeito não autenticado, sujeito forjado, autoridade diferente e papel
  doctor não atravessam preview/confirmation; sujeito paciente confiável é
  obrigatório.
- Nenhum `prescriptionId` ou owner recebido do cliente substitui a autorização
  confiável do backend.
- Não há endpoint/query que permita enumerar por token formatado, prescription
  ID, DOB, iniciais ou nome; respostas e tempos observáveis devem ser tratados
  com a mesma política de falha genérica.
- Raw token, digest, DOB, nome, iniciais e emissor não aparecem em erros,
  logs, telemetry-shaped fields, URLs, auditoria ou persistência não destinada
  à projeção.

### Rate limit, audit e transação

- Falhas de DOB e token são limitadas por paciente confiável, com fronteira de
  janela e isolamento entre pacientes testados; tentativas limitadas também
  são auditadas sem lookup revelador.
- Cada tentativa de preview/confirmation tem attempt/correlation ID opaco,
  timestamp de servidor e outcome allow-listed; sucesso, mismatch, token
  inválido, rate-limit e erro transacional têm cobertura.
- Falha de commit restaura projeção, contadores/rate state e audit; retry
  válido não duplica associação, consumo ou audit.
- O teste de integração comprova a ordem `authenticate -> masked preview ->
  DOB comparison -> trusted confirmation -> guarded consume/association`, com
  a última etapa respeitando o boundary transacional requerido por DEV-010.

### Regressão e compatibilidade

- `node --test apps/backend/test/claim-token-lifecycle.test.mjs` permanece
  aprovado e os testes existentes de identidade, ownership, prescrição,
  contratos e arquitetura continuam verdes.
- `npm run validate:node` deve passar; a validação completa local deve usar
  somente fakes/dados sintéticos e não deve criar rede/provider/credencial.
- Verificar `git diff --check`, inspeção de export público e scan negativo dos
  artefatos para impedir nova capacidade de mint de sujeito, SDK de provider
  ou segredo fora do boundary de emissão.

## Limite de TD-001

TD-001 continua `OPEN` e não bloqueia este desenvolvimento provider-neutral,
mas bloqueia qualquer ativação real. DEV-009 pode adicionar contratos,
serviços, fakes determinísticos, testes negativos e integração em memória. Não
pode selecionar ou conectar IdP/OCR/cloud/database/KMS/notification provider,
criar credenciais, definir região/rede/backup/retenção de produção, receber
prescrição real, implantar ingress ou operar claim com dados reais. Qualquer
decisão de arquitetura/provider deve ser tratada em gate/ADR próprio e não
ser inferida deste plano.
