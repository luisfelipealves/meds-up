---
id: PD-006
type: product-decision
title: Recuperação de associação por QR incorreta
status: APPROVED_FOR_DEVELOPMENT
source:
  - PD-001
  - PD-005
  - PQ-005
created: 2026-11-01
---

# PD-006 — Recuperação de associação por QR incorreta

## Decision

O paciente pode reportar uma prescrição associada à conta errada, mas não pode
desassociá-la por iniciativa própria. O médico emissor confirma a correção com
base nos seus registos; a administração do piloto só intervém se o médico não
estiver disponível.

Após confirmação, o backend revoga imediatamente a associação errada e impede
sincronização e lembretes futuros nessa conta. O médico emite novo QR com novo
token, uso único e validade de 7 dias para o paciente correto. O histórico
local já existente no dispositivo incorreto não é migrado; o produto não
promete apagá-lo remotamente se o dispositivo estiver offline.

## Requirements

- Reporte de erro cria caso auditável ligado à prescrição, claim e emissor.
- Apenas médico emissor, ou administração em contingência, autoriza correção.
- Revogação interrompe acesso/sincronização futuros da associação errada.
- Novo QR substitui o anterior e segue as regras de PD-001.
- Auditoria regista reporte, confirmação, revogação, reemissão e resgate novo.

## Acceptance criteria

- Paciente não consegue remover unilateralmente uma prescrição associada.
- Após revogação, conta errada não recebe atualizações ou lembretes futuros.
- Novo QR não reutiliza o token da associação errada.
- Fluxo não expõe dados sobre o paciente correto à conta errada.

## UX behavior

- A conta errada recebe comunicação neutra de que o acesso à prescrição cessou.
- O paciente correto recebe novo QR pelo fluxo do médico, sem detalhes do erro
  exibidos a terceiros.

## Out of scope

- Garantia de remote wipe em dispositivo offline.
- Migração de histórico local ou arbitragem clínica do erro.

## Evidence

- PD-001 e PD-005 definem QR de uso único, revogação e histórico local.
- Decisão humana de 2026-11-01 aprovou este fluxo.

## Human action required

Para autorizar o planeamento detalhado de DEV-021 após as dependências,
emitir explicitamente:

`Aprovo PD-006 para desenvolvimento.`
