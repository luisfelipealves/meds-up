---
id: PQ-001
type: product-question
title: Confirmação de identidade mascarada no claim
status: ANSWERED
source: PA-001 in TECH-PLAN-PD-001
created: 2026-11-01
---

# PQ-001 — Confirmação de identidade mascarada

## Question

Como confirmar que a pessoa a fazer claim de um QR é o paciente pretendido sem
expor informação clínica antes da associação?

## Human answer

No MVP, o claim exige login/criação de conta e confirmação da data de
nascimento. Antes do claim, mostrar apenas iniciais do paciente e nome do
médico ou clínica. Não mostrar medicamento, dose, diagnóstico ou outro dado
clínico. Em caso de falha, mostrar mensagem genérica, limitar tentativas e
registar auditoria.

## Resolution

PD-002 formaliza esta resposta. DEV-009 continua bloqueada até PD-002 ser
explicitamente aprovada para desenvolvimento.
