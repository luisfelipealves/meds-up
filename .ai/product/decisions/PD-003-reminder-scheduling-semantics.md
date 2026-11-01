---
id: PD-003
type: product-decision
title: Semântica de programação de lembretes
status: APPROVED_FOR_DEVELOPMENT
source:
  - PD-001
  - PQ-002
created: 2026-11-01
---

# PD-003 — Semântica de programação de lembretes

## Question

Como o MedsUp transforma instruções clínicas estruturadas em lembretes sem
interpretar, compensar ou alterar a prescrição?

## Decision

O MVP aceita apenas duas modalidades programáveis:

1. **Horários explícitos**, como `08:00` e `20:00`.
2. **Intervalos estritos**, como `a cada 8 horas`, com espaçamento preservado.

Instruções ambíguas ou condicionais — por exemplo, “duas vezes por dia”,
“quando necessário”, “com refeições” ou redução progressiva — não geram
lembretes automáticos. O médico deve estruturá-las em horários explícitos ou
clarificar a prescrição antes da confirmação.

Um lembrete pode ser adiado por 10, 30 ou 60 minutos. Isto reage apenas à
notificação local: não altera o horário clínico, os lembretes futuros ou o
estado da dose, que permanece `SEM_CONFIRMACAO` até ação explícita do paciente.

Toda prescrição programável tem data de início e, ou data de fim, ou indicação
explícita de tratamento contínuo pelo médico. Na data de fim, os lembretes
futuros param automaticamente.

Horários explícitos são fixos por padrão. O médico pode marcar a prescrição
como flexível e definir o intervalo mínimo permitido; só então o paciente pode
reorganizar horários permanentes sem violar esse mínimo. Intervalos estritos
só podem ser reorganizados quando o espaçamento exigido se mantém.

## Rationale

O escopo suporta os casos estruturáveis com menor risco no MVP e evita que o
produto converta linguagem clínica ambígua em orientação automática.

## Requirements

- O modelo estruturado identifica modalidade, início, fim/tratamento contínuo
  e, quando aplicável, flexibilidade e intervalo mínimo.
- Apenas o médico pode definir ou alterar regras clínicas e de flexibilidade.
- O paciente pode adiar localmente por 10, 30 ou 60 minutos.
- O paciente só pode alterar uma programação permanente quando as regras
  clínicas estruturadas a permitirem.
- O fim da prescrição cancela lembretes futuros sem apagar histórico local.

## Acceptance criteria

- Uma instrução ambígua não cria lembrete automático.
- Intervalos estritos preservam o espaçamento definido após qualquer ajuste
  permitido.
- Um adiamento não move a programação futura nem marca a dose como tomada.
- Horários explícitos sem flexibilidade são imutáveis pelo paciente.
- Horários flexíveis nunca violam o intervalo mínimo definido pelo médico.
- O fim de tratamento interrompe lembretes futuros automaticamente.

## UX behavior

- O médico vê quando uma instrução não pode ser programada e deve clarificá-la.
- O paciente vê apenas ações compatíveis com a regra da prescrição.
- O adiamento apresenta 10, 30 e 60 minutos, sem linguagem de recomendação
  clínica.

## Technical constraints

- A validação de modalidade, intervalo, flexibilidade, início e fim deve ser
  determinística e partilhada entre backend e clientes através de contratos.
- Fuso horário, horário de verão, reboot e execução offline devem preservar a
  regra clínica; a estratégia técnica pertence ao plano de arquitetura.

## Edge cases

- Um adiamento que alcança ou ultrapassa o próximo lembrete não muda a ordem
  clínica; ambos os eventos permanecem distinguíveis no histórico local.
- Prescrição terminada, suspensa ou cancelada não agenda novos lembretes.
- Alterar frequência, início, fim ou flexibilidade cria nova versão clínica e
  exige confirmação de programação pelo paciente conforme PD-001.

## Out of scope

- Compensar, repetir, ignorar clinicamente ou aconselhar sobre doses.
- Converter automaticamente instruções PRN, refeições ou redução progressiva.
- Deduções clínicas a partir de ação/ausência de ação do paciente.

## Evidence

- PD-001 separa instrução clínica de preferência operacional.
- Decisões humanas de 2026-11-01 sobre modalidades, adiamento, duração e
  flexibilidade.

## Open questions

- Estratégia técnica de notificações offline, reboot, fuso horário e horário
  de verão.
- Recuperação de claim incorreto, convites médicos, recuperação de conta e
  retenção, tratadas em decisões separadas.

## Human action required

Para autorizar o planeamento detalhado de DEV-011 após dependências técnicas,
emitir explicitamente:

`Aprovo PD-003 para desenvolvimento.`
