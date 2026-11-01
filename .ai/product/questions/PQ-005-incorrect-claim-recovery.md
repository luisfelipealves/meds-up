---
id: PQ-005
type: product-question
title: Recuperação de claim incorreto
status: ANSWERED
source: PA-005 in TECH-PLAN-PD-001
created: 2026-11-01
---

# PQ-005 — Recuperação de claim incorreto

## Human answer

O paciente pode reportar o erro, mas não se auto-desassocia. O médico emissor
confirma a correção pelos seus registos; a administração intervém só se ele não
estiver disponível. A associação errada é revogada, sincronização e lembretes
futuros param, e o médico emite novo QR válido por 7 dias. Histórico local não
é migrado nem se promete apagá-lo em dispositivo offline. Todo o fluxo é
auditado.

## Resolution

PD-006 formaliza esta resposta. DEV-021 continua bloqueada até PD-006 ser
explicitamente aprovada para desenvolvimento.
