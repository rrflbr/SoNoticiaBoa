# Clip 10 — histórico dos últimos 10 itens copiados (iPhone)

App iOS (SwiftUI) + teclado personalizado que guardam os **10 últimos textos copiados**
e deixam colar qualquer um deles de novo, com um botão **“Colar expandido”** que abre a lista.

> ⚠️ Este código foi escrito sem Xcode disponível, então **ainda não foi compilado nem testado
> num aparelho**. Espere ajustar pequenos detalhes no primeiro build.

## O que o iOS permite (e o que não permite)

O pedido era: segurar o cursor → aparece “Colar” → aparece também “Colar expandido” → lista dos itens.
O iOS limita isso, então o app entrega o mais próximo possível em duas frentes:

| Onde | Funciona como você pediu? |
|---|---|
| **Campos do próprio app** (tela *Testar*) | **Sim.** Segurar o cursor mostra “Colar” + “Colar expandido ›” com a lista dos 10 itens. |
| **Qualquer outro app** (Notas, WhatsApp, Safari…) | **Não no menu do sistema** — nenhum app pode alterar o menu “Colar” de outros apps. Alternativa: o **teclado Clip 10**, que tem o botão “Colar expandido” com a mesma lista. |

Outra limitação do iOS: **não existe monitoramento da área de transferência em segundo plano.**
As cópias são registradas quando:

1. você abre o app (ou puxa a lista para atualizar);
2. o teclado Clip 10 aparece (registra o que está na área de transferência naquele momento);
3. você roda o atalho **“Salvar no histórico”** (app Atalhos), que pode ser ligado a *Toque nas Costas*
   (Ajustes › Acessibilidade › Toque › Toque nas Costas) para registrar cada cópia sem abrir nada:
   `Obter Área de Transferência` → `Salvar no histórico`.

Sem o item 3, só o **último** item copiado antes de abrir o app/teclado é guardado; cópias feitas em sequência
sem passar por um desses três pontos se perdem.

## Gerar o projeto (precisa de um Mac com Xcode 15+)

```bash
brew install xcodegen
cd ClipboardHistory-iOS
# edite DEVELOPMENT_TEAM em project.yml (ou escolha o Team no Xcode depois)
xcodegen generate
open ClipboardHistory.xcodeproj
```

- Rode no aparelho (o teclado e o App Group não funcionam bem no simulador de algumas versões).
- Se o App Group `group.com.sonoticiaboa.clipboardhistory` ou os Bundle IDs já estiverem em uso na sua conta Apple,
  troque-os em `project.yml` **e** em `Shared/ClipboardStore.swift` (`appGroupID`).
- Testes: `⌘U` roda `ClipboardStoreTests` (limite de 10, duplicados, itens vazios, apagar/limpar).

## Ativar no iPhone

1. Abra o app **Clip 10** uma vez.
2. Ajustes › Geral › Teclado › Teclados › Adicionar Novo Teclado › **Clip 10**.
3. Toque em **Clip 10** na lista e ative **Permitir Acesso Total** (necessário para ler o histórico compartilhado
   e a área de transferência; o app não envia nada para a internet).
4. Em qualquer campo de texto: segure o 🌐 e escolha **Clip 10**. O item mais recente aparece com **Colar**;
   toque em **Colar expandido** para ver os 10 itens e toque em um para inserir.

## Estrutura

```
App/        SwiftUI: lista do histórico, tela de teste, menu “Colar expandido”, ação do app Atalhos
Keyboard/   Extensão de teclado (UIInputViewController + SwiftUI)
Shared/     ClipboardStore (App Group, máx. 10, sem duplicar) e PasteboardCapture
Tests/      Testes unitários do ClipboardStore
project.yml Definição do projeto para o XcodeGen
```

## Privacidade

Tudo fica no aparelho (UserDefaults do App Group). O histórico pode conter senhas ou dados sensíveis copiados;
use **Limpar** no app quando quiser apagar. O iOS 16+ pode exibir o aviso “Permitir colar” quando o app lê a área
de transferência de outro app; o código só lê o conteúdo quando algo novo foi copiado, para reduzir esses avisos.
