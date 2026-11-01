---
id: PD-008
type: product-decision
title: Processamento efémero de documentos e OCR
status: APPROVED_FOR_DEVELOPMENT
source:
  - PD-001
  - PD-007
created: 2026-11-01
country: PT
---

# PD-008 — Processamento efémero de documentos e OCR

## Decision

O MedsUp não conserva documentos de prescrição enviados pelo médico, imagens,
PDFs, scans, nem a resposta OCR/IA bruta. O ficheiro é encaminhado para a API
de IA exclusivamente para extrair os campos necessários à revisão clínica e é
descartado quando o pedido à API termina, falha ou expira.

Os campos estruturados extraídos constituem uma proposta não confiável, ligada
apenas à sessão de revisão do médico. A proposta não é persistida em base de
dados, backup, fila durável, analytics ou logs; ao terminar, expirar ou ser
abandonada a sessão, é descartada. Se o médico quiser retomar o trabalho,
submete novamente o documento.

Apenas quando o médico corrige, revê e confirma explicitamente a proposta é
criada uma prescrição estruturada persistente. Essa confirmação permanece a
única fonte para QR, sincronização e lembretes.

## Requirements

- Não existe bucket, tabela, anexo, backup ou URL público para documentos de
  origem ou resposta OCR bruta.
- O ficheiro passa por um caminho de processamento efémero, com validação de
  tipo, tamanho e autorização antes do encaminhamento à API de IA.
- A proposta estruturada só existe na sessão ativa, sem persistência local do
  navegador, servidor, cache partilhada ou mecanismo de recuperação após
  reload.
- O fim, expiração, erro ou abandono da sessão descarta ficheiro e proposta.
- Logs, traces, mensagens de erro e métricas não incluem imagem, PDF, texto
  OCR, campos clínicos ou identificadores que os revelem.
- O fornecedor de IA deve estar contratado como subcontratante adequado, com
  retenção de pedidos/respostas desativada ou limitada ao estritamente
  necessário, proibição de treino com estes dados e garantias de segurança e
  localização compatíveis com o piloto em Portugal.
- O produto conserva apenas o registo mínimo não clínico de que ocorreu uma
  operação, quando necessário para segurança/auditoria, sem documento, texto
  extraído ou conteúdo de prescrição.

## Acceptance criteria

- Não é possível recuperar um documento enviado ou resposta OCR bruta depois
  da conclusão, falha ou expiração da operação.
- Atualizar a página, terminar sessão ou exceder o tempo de revisão obriga a
  novo envio do documento.
- Nenhuma proposta não confirmada sobrevive à sessão nem pode gerar lembretes.
- Uma prescrição persistente só é criada pela confirmação explícita do médico.
- Testes e inspeção de logs demonstram ausência de conteúdo clínico e ficheiros
  nos mecanismos de persistência previstos.

## UX behavior

- A interface informa o médico de que o documento não será arquivado e que a
  proposta desaparece se a sessão terminar sem confirmação.
- Antes da confirmação, o médico pode corrigir os campos extraídos; se optar
  por sair, a operação é simplesmente descartada.
- Erros de processamento pedem novo envio sem mostrar o conteúdo do documento
  em mensagens de diagnóstico.

## Out of scope

- Arquivo documental de prescrições ou consulta posterior da imagem original.
- Recuperação de proposta de OCR abandonada.
- Escolha de fornecedor de IA sem validação de privacidade, segurança e
  contratação adequadas.

## Evidence

- Decisão humana de 2026-11-01: não guardar documentos ou OCR enviados pelos
  médicos; enviar apenas para API de IA para extração; proposta existe apenas
  durante a sessão e é descartada sem confirmação.
- PD-001 continua a exigir confirmação explícita do médico antes de lembretes.

## Approval

Aprovada para desenvolvimento em 2026-11-01. Esta decisão substitui as partes
de PD-001 e PD-007 relativas à persistência de documentos-fonte e resultados
OCR.
