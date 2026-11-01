---
id: PQ-002
type: product-question
title: Semântica de programação de lembretes
status: ANSWERED
source: PA-002 in TECH-PLAN-PD-001
created: 2026-11-01
---

# PQ-002 — Semântica de programação de lembretes

## Question

Que formas de frequência o MVP suporta e como preserva as restrições clínicas
quando o paciente interage com lembretes?

## Human answer

O MVP suporta apenas horários explícitos e intervalos estritos. Adiar apenas
reagenda a notificação por 10, 30 ou 60 minutos; não altera a programação
clínica. A prescrição tem início e fim, ou indicação explícita de tratamento
contínuo. Horários explícitos são fixos por padrão; o médico pode marcar uma
prescrição como flexível e definir o intervalo mínimo permitido.

## Resolution

PD-003 formaliza esta resposta. DEV-011 continua bloqueada até PD-003 ser
explicitamente aprovada para desenvolvimento.
