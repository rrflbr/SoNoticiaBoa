import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: HistoryModel
    @State private var copiedID: UUID?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if model.items.isEmpty {
                        Text("Nada por aqui ainda. Copie um texto em qualquer app e volte para cá.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(model.items) { item in
                        Button {
                            model.copy(item)
                            copiedID = item.id
                        } label: {
                            row(for: item)
                        }
                        .swipeActions {
                            Button("Apagar", role: .destructive) { model.remove(item) }
                        }
                    }
                } header: {
                    Text("Histórico (\(model.items.count)/\(ClipboardStore.maxItems))")
                } footer: {
                    Text("Toque num item para copiá-lo de novo.")
                }

                Section("Testar") {
                    NavigationLink("Campo com “Colar expandido”") { PasteTestView() }
                }

                Section("Ativar o teclado (uso em qualquer app)") {
                    Text("1. Ajustes › Geral › Teclado › Teclados › Adicionar Novo Teclado › Clip 10.")
                    Text("2. Toque em Clip 10 e ative “Permitir Acesso Total”. Sem isso o teclado não lê o histórico.")
                    Text("3. Em qualquer campo de texto, segure o 🌐 e escolha Clip 10. Toque em “Colar expandido” para ver os 10 itens.")
                }

                Section("Capturar sem abrir o app") {
                    Text("O iOS não permite monitorar a área de transferência em segundo plano. Para registrar uma cópia sem abrir o app, crie um atalho no app Atalhos: “Obter Área de Transferência” › “Salvar no histórico”, e associe-o a Toque Duplo/Triplo nas Costas (Ajustes › Acessibilidade › Toque).")
                        .font(.footnote)
                }
            }
            .navigationTitle("Clip 10")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Limpar", role: .destructive) { model.clear() }
                        .disabled(model.items.isEmpty)
                }
            }
            .refreshable { model.refresh(capture: true) }
        }
    }

    private func row(for item: ClipItem) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.text)
                    .lineLimit(3)
                    .foregroundStyle(.primary)
                Text(item.date, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: copiedID == item.id ? "checkmark.circle.fill" : "doc.on.doc")
                .foregroundStyle(copiedID == item.id ? .green : .secondary)
        }
    }
}

/// Tela de teste: segure o cursor, toque em “Colar” e depois em “Colar expandido”.
struct PasteTestView: View {
    @State private var text = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Segure o cursor no campo abaixo. Ao aparecer “Colar”, procure também “Colar expandido”.")
                .font(.callout)
                .foregroundStyle(.secondary)
            PasteField(text: $text)
                .frame(height: 180)
            Spacer()
        }
        .padding()
        .navigationTitle("Colar expandido")
        .navigationBarTitleDisplayMode(.inline)
    }
}
