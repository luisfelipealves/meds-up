---
id: PD-007
type: product-decision
title: Retenção, portabilidade e eliminação de dados — piloto Portugal
status: APPROVED_FOR_DEVELOPMENT
source:
  - PD-001
  - PD-005
  - PD-006
  - PA-006
created: 2026-11-01
country: PT
---

# PD-007 — Retenção, portabilidade e eliminação de dados

## Decision

Para o piloto em Portugal, os dados no servidor são conservados durante cinco
anos, contados desde a última atividade clinicamente ou operacionalmente
relevante do respetivo registo. O prazo aplica-se a prescrições, versões,
associações, documentos de origem, dados de conta, eventos de lembrete
sincronizados e registos de auditoria necessários à operação segura do
produto.

O paciente autenticado dispõe de duas operações distintas:

1. requisitar uma exportação dos seus dados pessoais; e
2. solicitar a eliminação da conta e dos seus dados pessoais.

A eliminação deixa de expor a conta e impede sessões e sincronizações futuras.
Os dados são eliminados ou anonimizados no fim do prazo de retenção aplicável,
salvo retenção estritamente necessária por obrigação legal, defesa de direitos,
incidente de segurança ou litígio documentado. Essa exceção é restringida ao
mínimo necessário, fica auditada e não permite o uso normal do dado.

O médico mantém a responsabilidade clínica pelas prescrições que emite. Isto
não elimina as obrigações próprias da plataforma quanto à segurança, exercício
de direitos e tratamento de dados sob a sua responsabilidade ou instruções.

## Requirements

- O período normal de conservação é de cinco anos por classe de dado, com
  registo do evento que reinicia ou determina a contagem.
- A exportação inclui os dados do paciente, contas/dispositivos, prescrições a
  que tem acesso, versões, agenda e estados sincronizados, claims, pedidos e
  eventos de auditoria que lhe digam respeito, em formato estruturado e
  legível; não inclui dados de outros titulares nem segredos de segurança.
- O pedido de eliminação exige autenticação recente e confirmação explícita;
  revoga sessões, tokens e sincronização da conta.
- Dados já existentes num dispositivo offline não são objeto de promessa de
  eliminação remota; a aplicação oferece eliminação local quando voltar a ser
  usada.
- Cada pedido de exportação, eliminação, restrição, execução, exceção e fim de
  retenção é auditável.
- Uma retenção excepcional exige motivo, âmbito, responsável, data de início e
  data de revisão; acessos ficam restritos durante a retenção.
- Backups são cifrados, têm expiração definida e não podem ressuscitar contas
  ou dados eliminados após restauro; o produto mantém um marcador de eliminação
  para esse efeito.
- Logs e métricas não incluem conteúdo clínico ou documentos de prescrição.

## Acceptance criteria

- Um paciente autenticado consegue pedir e obter uma exportação completa dos
  seus dados elegíveis sem expor dados de terceiros.
- Um pedido confirmado desativa a conta, invalida sessões e inicia o ciclo de
  eliminação, com estado consultável e evidência auditável.
- Dados sujeitos a uma exceção de retenção deixam de estar disponíveis para
  utilização normal e são revistos no prazo registado.
- Após o prazo de cinco anos, dados sem exceção são eliminados ou anonimizados
  por processo verificável.
- Um restauro de backup não reativa dados cujo ciclo de eliminação já foi
  concluído.

## UX behavior

- A área de privacidade explica a diferença entre exportação, eliminação da
  conta, prazo de processamento e dados temporariamente retidos por exceção.
- Antes de confirmar a eliminação, o paciente vê que perderá acesso à conta e
  às sincronizações; recomenda-se pedir a exportação primeiro.
- O estado do pedido comunica apenas factos verificáveis, sem prometer apagar
  remotamente um dispositivo offline.

## Out of scope

- Definir uma política clínica de conservação para o médico fora do MedsUp.
- Apagar remotamente dados que só existam num dispositivo offline.
- Usar dados de saúde para publicidade, perfilagem comercial ou métricas de
  produto.

## Evidence

- Lei n.º 58/2019, artigo 21.º: a conservação segue prazo legal/regulamentar
  ou, na falta dele, o necessário à finalidade.
- RGPD, artigo 5.º: limitação da conservação e minimização dos dados.
- Decisão humana de 2026-11-01: piloto em Portugal, conservação por cinco
  anos, exportação de dados e eliminação de conta/dados.

## Approval

Aprovada para desenvolvimento em 2026-11-01.
