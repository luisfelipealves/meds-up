---
id: PD-004
type: product-decision
title: Política de convite de médicos no piloto
status: READY_FOR_HUMAN_REVIEW
source:
  - PD-001
  - PQ-003
created: 2026-11-01
---

# PD-004 — Política de convite de médicos no piloto

## Question

Como controlar a adesão de médicos durante o piloto sem auto-cadastro público
ou uma verificação profissional europeia completa?

## Decision

Qualquer médico com conta ativa pode convidar outro médico para o piloto. Cada
convite é associado a um email profissional, pode ser usado uma única vez e
expira ao fim de 7 dias. O resgate cria uma conta operacional ativa, sem etapa
de aprovação administrativa adicional.

Emitir um novo convite para o mesmo email revoga os convites anteriores ainda
ativos. O sistema regista emissor, destinatário, criação, expiração, resgate,
revogação e motivo de reemissão. Administração do piloto pode revogar convites
e suspender contas quando necessário.

O convite controla acesso operacional ao piloto; não prova habilitação
profissional nem substitui futura verificação adequada por país/mercado.

## Rationale

O convite entre pares reduz fricção no piloto e permite crescimento controlado,
preservando rastreabilidade e capacidade de intervenção administrativa.

## Requirements

- Não existe auto-cadastro público de médicos.
- Só médicos ativos podem emitir convites.
- Cada convite é vinculado a um email profissional, uso único e validade de 7
  dias.
- O resgate ativa a conta sem aprovação manual posterior.
- Novo convite para o mesmo email invalida convites ativos anteriores.
- Convites, relação emissor-convidado, estados e ações administrativas são
  auditáveis.
- Uma conta suspensa não pode entrar, convidar, importar, criar ou gerir
  prescrições.

## Acceptance criteria

- Um utilizador não autenticado não cria conta médica diretamente.
- Um médico ativo cria convite para email profissional e o convidado só o usa
  uma vez antes da expiração.
- Resgatar convite válido cria conta ativa e utilizável imediatamente.
- Um convite substituído, revogado, expirado ou usado não cria conta.
- A suspensão bloqueia capacidade clínica e de convite da conta.
- A auditoria permite seguir a cadeia de convites.

## UX behavior

- O médico emissor vê convites que criou e respetivo estado, sem acesso a
  informação clínica de médicos convidados.
- O convidado vê mensagem neutra quando o convite está inválido, expirado ou
  revogado, sem revelar dados sobre outras contas.

## Technical constraints

- O backend aplica autorização de emissão, uso único, expiração, revogação e
  suspensão; a UI não é a única barreira.
- Registo de convites deve evitar enumeração de emails e exposição de tokens em
  URLs, logs ou analytics.

## Edge cases

- Um médico suspenso não emite nem resgata convites.
- Reemissão para o mesmo email invalida o convite anterior atomicamente.
- Um convite usado não pode ser usado novamente, mesmo após criação de outra
  sessão ou tentativa concorrente.

## Out of scope

- Verificação definitiva de credenciais profissionais.
- Auto-cadastro público.
- Fluxo comercial, billing ou gestão de organizações/clínicas complexas.

## Evidence

- PD-001 restringe o MVP a convite e não trata convite como validação
  profissional definitiva.
- Decisão humana de 2026-11-01 aprovou convites entre médicos sem ativação
  administrativa posterior.

## Open questions

- Critérios e processo de verificação profissional para expansão além do
  piloto.
- Recuperação de conta/dispositivo e retenção de dados, tratadas separadamente.

## Human action required

Para autorizar o planeamento detalhado de DEV-019 após a fundação de
identidade, emitir explicitamente:

`Aprovo PD-004 para desenvolvimento.`
