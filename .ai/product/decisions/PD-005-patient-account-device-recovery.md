---
id: PD-005
type: product-decision
title: Recuperação de conta e dispositivo do paciente
status: READY_FOR_HUMAN_REVIEW
source:
  - PD-001
  - PQ-004
created: 2026-11-01
---

# PD-005 — Recuperação de conta e dispositivo do paciente

## Decision

No MVP, a conta de paciente usa email e palavra-passe. Recuperação de acesso
usa link enviado para email verificado, sem SMS obrigatório. Recuperar a conta
ou declarar dispositivo perdido revoga todas as sessões e dispositivos
autorizados; o paciente autentica-se novamente.

Num novo dispositivo, o backend sincroniza apenas prescrições ativas e horários
aprovados. O histórico de lembretes (`SEM_CONFIRMACAO`, `TOMADA`, `ADIADA`,
`DISPENSADA`) continua exclusivamente local e não é migrado/restaurado.

Dispositivo revogado deixa de sincronizar quando volta à rede. O produto não
promete apagar remotamente dados de um dispositivo offline.

## Rationale

Esta política permite recuperação prática sem transformar histórico local em
dados de adesão centralizados, mantendo um limite claro para dispositivos
perdidos que estejam offline.

## Requirements

- Email verificado é a base de recuperação de conta.
- Recuperação e dispositivo perdido revogam sessões/dispositivos existentes.
- Novo dispositivo recebe somente prescrições ativas e horários aprovados.
- Histórico local não entra em APIs, sincronização, analytics ou interface
  médica.
- Revogação impede novo acesso/sincronização quando o dispositivo volta online.

## Acceptance criteria

- Link de recuperação válido permite recuperar acesso sem SMS.
- Após recuperação, sessões anteriores não acedem a dados novos do backend.
- Novo dispositivo não apresenta histórico local anterior, mas apresenta agenda
  ativa sincronizada.
- Médico nunca vê histórico local de lembretes.
- O produto não afirma conseguir apagar dados de dispositivo offline.

## Out of scope

- Migração/restauro de histórico local.
- SMS obrigatório, biometria como fator remoto ou garantia de remote wipe.
- Escolha de fornecedor de autenticação e mecanismos técnicos de sessão.

## Evidence

- PD-001 define histórico de lembretes como local ao paciente.
- Decisão humana de 2026-11-01 sobre recuperação, revogação e novo dispositivo.

## Open questions

- Implementação de sessões, tokens, encriptação local e notificação de
  revogação.
- Política de retenção de dados e recuperação de claim incorreto.

## Human action required

Para autorizar o planeamento detalhado de DEV-020 após a fundação de
identidade, emitir explicitamente:

`Aprovo PD-005 para desenvolvimento.`
