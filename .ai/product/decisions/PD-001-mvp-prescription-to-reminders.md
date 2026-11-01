---
id: PD-001
type: product-decision
title: MedsUp MVP — prescrição para lembretes
status: APPROVED_FOR_DEVELOPMENT
source:
  - Contexto preservado: Arquitetura de prescrição digital
  - Decisões de produto de 2026-11-01
created: 2026-11-01
---

# PD-001 — MedsUp MVP: prescrição para lembretes

## Question

Qual é o comportamento de produto do MVP que converte uma prescrição médica
confirmada em lembretes práticos e seguros para o paciente?

## Decision

O MedsUp será uma plataforma europeia que liga uma prescrição estruturada,
confirmada pelo médico, à rotina de lembretes do paciente. O MVP terá PWA para
o médico, aplicações Android e Wear OS para o paciente e backend independente
das plataformas.

O médico importa um PDF, ficheiro digital, fotografia ou scan. OCR/IA pode
propor dados estruturados, mas só a revisão e confirmação explícita do médico
permite gerar lembretes. O documento original e a prescrição estruturada
confirmada são entidades distintas.

O paciente associa cada prescrição através de QR Code que contém apenas um
token aleatório. O QR é de utilização única, expira ao fim de 7 dias, pode ser
revogado e substituído pelo médico, e mostra uma confirmação de identidade
parcialmente mascarada antes do claim. O QR nunca contém informação clínica ou
pessoal. Após o claim, o vínculo médico-paciente permite sincronização de
alterações futuras sem novo QR.

O paciente pode reunir prescrições de vários médicos, mas cada médico vê e
gere apenas as prescrições que criou/importou. O paciente não altera dose,
frequência, duração ou instruções clínicas; pode confirmar ou ajustar horários
de lembrete apenas dentro das restrições da prescrição. Intervalos clínicos
estritos não são alterados por conveniência.

Cada lembrete nasce com o estado local `SEM_CONFIRMACAO`. O paciente pode
marcá-lo como `TOMADA`, `ADIADA` ou `DISPENSADA`. Este histórico é local ao
paciente no MVP e não é partilhado com o médico. O produto não infere doses
esquecidas, não recomenda compensação/repetição e não toma decisões clínicas.

Se o médico suspender ou cancelar uma prescrição, todos os lembretes futuros
param imediatamente, o histórico local é preservado e o paciente recebe uma
notificação clara. Alterações clínicas geram uma nova versão auditável; se a
frequência mudar, o sistema propõe novos horários e o paciente confirma os
horários permitidos.

## Rationale

O escopo mantém o diferencial do MedsUp — prescrição para rotina — sem exigir
integração imediata com todos os sistemas de prescrição, sem transformar o MVP
num produto de monitorização clínica e sem delegar decisões clínicas à IA.

## Requirements

- Médicos entram apenas por convite individual, de uso único e com expiração.
- Um médico importa, revê, corrige e confirma a prescrição antes de a enviar.
- Uma prescrição confirmada gera QR de claim de uso único, válido por 7 dias,
  revogável e sem dados de saúde no payload.
- Antes do claim, o paciente vê confirmação de identidade parcialmente
  mascarada; o detalhe de apresentação será definido no design de UX.
- Paciente novo cria conta durante o claim; paciente existente associa a nova
  prescrição à conta existente.
- Prescrições, documentos-fonte, versões, alterações e auditoria são distintos
  e rastreáveis.
- O paciente vê uma agenda consolidada das prescrições ativas de vários
  médicos.
- Lembretes já sincronizados devem continuar disponíveis temporariamente sem
  rede; a estratégia técnica será definida na arquitetura.
- Android é o cliente principal; Wear OS é uma extensão de lembretes. A PWA é
  a interface do médico.

## Acceptance criteria

- Um médico não consegue enviar lembretes a partir de OCR/IA não confirmado.
- Um QR nunca expõe dados pessoais ou clínicos e não pode ser reutilizado após
  claim bem-sucedido, expiração ou revogação.
- O paciente não consegue editar conteúdo clínico da prescrição, mas consegue
  ajustar horários permitidos.
- Um lembrete inicia em `SEM_CONFIRMACAO` e só muda por ação explícita local.
- O médico não consegue visualizar o histórico local de tomada do paciente no
  MVP.
- Suspender/cancelar uma prescrição remove os seus lembretes futuros sem apagar
  o histórico local.
- Uma alteração de frequência cria versão auditável e exige nova confirmação de
  horários pelo paciente.
- Médicos não conseguem consultar ou gerir prescrições de outros médicos.

## UX behavior

- O médico revê os campos extraídos e vê claramente que a confirmação torna os
  dados a fonte dos lembretes.
- O paciente vê horários propostos, podendo escolher alternativas compatíveis
  quando a prescrição o permite.
- Uma notificação não respondida permanece `SEM_CONFIRMACAO`; nunca é tratada
  como orientação sobre uma dose esquecida.
- A suspensão/cancelamento explica que a alteração partiu do médico e interrompe
  lembretes futuros.

## Technical constraints

- Backend independente de Android/Wear OS para permitir futura expansão a iOS
  e watchOS.
- QR representa apenas token criptograficamente aleatório; a prescrição vive no
  backend e suporta versões.
- Dados de saúde requerem controlo de acesso, auditoria e minimização de dados.
- A escolha de backend, identidade, OCR/IA, notificações, armazenamento e
  residência de dados pertence à arquitetura/planeamento posterior.

## Edge cases

- QR expirado, revogado ou já utilizado não pode concluir o claim.
- Alteração de frequência invalida a programação anterior até o paciente
  confirmar a nova programação permitida.
- Dispositivo sem rede conserva lembretes já sincronizados, sem alegar entrega
  absoluta de notificações.
- Relógio desconectado não substitui o telemóvel como fonte de gestão.
- Um claim incorreto deve poder ser investigado por auditoria; o mecanismo de
  recuperação/revogação detalhado continua em aberto.

## Out of scope

- Monitorização de adesão pelo médico.
- Introdução manual de medicamentos, vitaminas ou suplementos pelo paciente.
- Recomendação clínica, alteração/compensação de dose ou interpretação autónoma
  de prescrições ambíguas.
- Gestão de stock, reposição e alertas de quantidade.
- Integrações com sistemas de prescrição, padrões europeus de ePrescription ou
  verificação profissional pública no MVP.
- iOS/watchOS no MVP.
- Decisão de monetização, billing ou tecnologia concreta de backend/OCR.

## Evidence

- Handoff «Arquitetura de prescrição digital», fornecido pelo utilizador em
  2026-11-01.
- Decisões humanas posteriores: QR de uso único com validade de 7 dias e
  confirmação parcialmente mascarada; histórico de lembretes local; estado
  inicial `SEM_CONFIRMACAO`; suspensão interrompe lembretes futuros.

## Open questions

- Mecanismo de autenticação, recuperação de conta e tratamento de dispositivo
  perdido/roubado para pacientes.
- Dados concretos e fluxo de correção para a confirmação de identidade
  parcialmente mascarada.
- Verificação profissional após o piloto por convite.
- Obrigações legais, GDPR, retenção, residência de dados e classificação
  regulatória antes de produção.
- Estratégia de entrega de notificações, fuso horário, horário de verão,
  reinício, bateria e sincronização offline.
- Stack de backend, persistência, OCR/IA, criptografia e gestão de sessões.

## Human action required

Rever esta decisão. Para autorizar desenvolvimento, emitir explicitamente:

`Aprovo PD-001 para desenvolvimento.`
