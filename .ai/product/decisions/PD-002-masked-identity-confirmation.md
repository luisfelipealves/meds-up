---
id: PD-002
type: product-decision
title: Confirmação de identidade no claim de QR
status: READY_FOR_HUMAN_REVIEW
source:
  - PD-001
  - PQ-001
created: 2026-11-01
---

# PD-002 — Confirmação de identidade no claim de QR

## Question

Como reduzir o risco de claim de uma prescrição pela pessoa errada sem revelar
informação clínica a quem lê um QR?

## Decision

O claim exige que a pessoa inicie sessão ou crie conta e confirme a sua data
de nascimento contra o valor associado à prescrição. Antes da associação, a
interface mostra apenas as iniciais do paciente e o nome do médico ou clínica.
Não mostra medicamento, dose, diagnóstico, instruções clínicas nem detalhes
adicionais de identidade.

Uma data de nascimento incompatível não conclui o claim. A interface mostra
uma mensagem genérica para contactar o médico ou clínica, sem revelar se um
paciente específico existe. Tentativas falhadas são limitadas e auditadas.

## Rationale

O QR de uso único e curta validade prova posse, mas não identidade. A
confirmação de data de nascimento adiciona uma verificação de baixo atrito no
piloto, enquanto a visualização limitada reduz a exposição de dados de saúde
caso o QR seja lido por terceiro.

## Requirements

- Exigir autenticação ou criação de conta antes de concluir o claim.
- Comparar a data de nascimento fornecida com o valor associado à prescrição.
- Mostrar apenas iniciais do paciente e médico/clínica antes do claim.
- Nunca incluir dados clínicos no QR, URL, ecrã pré-claim, logs ou mensagens
  de erro.
- Limitar e auditar tentativas falhadas de confirmação/claim.
- Manter o QR de uso único, validade de 7 dias, revogação e substituição
  definidos em PD-001.

## Acceptance criteria

- Sem data de nascimento compatível, nenhuma prescrição é associada à conta.
- Um ecrã de falha não revela dados clínicos nem confirma a existência de um
  paciente específico.
- Um ecrã pré-claim não revela mais do que iniciais e médico/clínica.
- Cada tentativa e resultado de claim é auditável.
- Um claim bem-sucedido invalida o QR; tentativas posteriores não expõem dados.

## UX behavior

- A pessoa vê o emissor e as iniciais e confirma que a prescrição lhe pertence.
- Introduz a data de nascimento para concluir o claim.
- Em caso de erro, recebe instrução neutra para contactar o emissor, sem
  sugestão clínica ou exposição adicional.

## Technical constraints

- Comparação, limitação de tentativas e auditoria são efetuadas no backend.
- Dados de data de nascimento e tentativas são dados sensíveis e seguem os
  controlos de acesso e retenção a definir.
- Esta decisão não define recuperação de claim incorreto, política de retenção
  ou autenticação/recuperação de conta completas.

## Edge cases

- QR expirado, revogado ou já usado falha com mensagem genérica.
- Dados de nascimento errados repetidos acionam limitação sem expor detalhes.
- Claim já concluído segue o fluxo de recuperação definido futuramente em
  PA-005/PQ correspondente.

## Out of scope

- SMS como fator obrigatório.
- Verificação nacional de identidade, biometria ou verificação profissional.
- Recuperação de claim incorreto.
- Escolha do fornecedor de identidade/autenticação.

## Evidence

- PD-001 exige QR de uso único, validade de 7 dias e confirmação parcialmente
  mascarada.
- Decisão humana de 2026-11-01 aprovou a direção definida nesta decisão.

## Open questions

- Qual é o mecanismo completo de autenticação, recuperação de conta e
  revogação de dispositivo (PA-004).
- Como recuperar uma associação feita à pessoa errada (PA-005).
- Política de retenção para dados de identidade, auditoria e backups (PA-006).

## Human action required

Para autorizar a implementação de DEV-009 após as suas dependências técnicas,
emitir explicitamente:

`Aprovo PD-002 para desenvolvimento.`
