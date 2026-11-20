import SwiftUI
import UIKit

struct KeyboardView: View {
    @ObservedObject var model: KeyboardModel
    let controller: UIInputViewController

    var body: some View {
        VStack(spacing: 8) {
            header
            content
            bottomBar
        }
        .padding(8)
    }

    // MARK: Topo

    private var header: some View {
        HStack {
            Text("Clip 10 · \(model.items.count)/\(ClipboardStore.maxItems)")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            Spacer()
            if model.hasFullAccess && !model.items.isEmpty {
                Button {
                    withAnimation(.snappy) { model.expanded.toggle() }
                } label: {
                    Label(
                        model.expanded ? "Recolher" : "Colar expandido",
                        systemImage: model.expanded ? "chevron.up" : "list.bullet.clipboard"
                    )
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(.tint.opacity(0.15), in: Capsule())
                }
            }
        }
    }

    // MARK: Conteúdo

    @ViewBuilder
    private var content: some View {
        if !model.hasFullAccess {
            message("Ative “Permitir Acesso Total” em Ajustes › Geral › Teclado › Teclados › Clip 10 para ver o histórico.")
        } else if model.items.isEmpty {
            message("Nada copiado ainda. Copie um texto e volte a este teclado.")
        } else if model.expanded {
            expandedList
        } else if let latest = model.items.first {
            latestCard(latest)
        }
    }

    /// Modo normal: o item mais recente com o botão “Colar”.
    private func latestCard(_ item: ClipItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(item.text)
                .lineLimit(5)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            Button {
                model.paste(item)
            } label: {
                Text("Colar")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 10))
                    .foregroundStyle(.white)
            }
        }
        .padding(12)
        .frame(maxHeight: .infinity)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    /// Modo “Colar expandido”: lista com os itens copiados.
    private var expandedList: some View {
        ScrollView {
            LazyVStack(spacing: 6) {
                ForEach(model.items) { item in
                    Button { model.paste(item) } label: {
                        HStack {
                            Text(item.text)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                                .foregroundStyle(.primary)
                            Spacer(minLength: 0)
                        }
                        .padding(10)
                        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
        }
        .frame(maxHeight: .infinity)
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.callout)
            .multilineTextAlignment(.center)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding()
    }

    // MARK: Rodapé

    private var bottomBar: some View {
        HStack(spacing: 8) {
            if controller.needsInputModeSwitchKey {
                GlobeButton(controller: controller)
                    .frame(width: 44, height: 40)
                    .background(Color(.systemGray4), in: RoundedRectangle(cornerRadius: 8))
            }
            keyButton("espaço") { model.insertSpace() }
            keyButton(systemImage: "delete.left") { model.deleteBackward() }
                .frame(width: 56)
            keyButton(systemImage: "return") { model.insertReturn() }
                .frame(width: 56)
        }
        .frame(height: 40)
    }

    private func keyButton(_ title: String? = nil, systemImage: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Group {
                if let systemImage { Image(systemName: systemImage) } else { Text(title ?? "") }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemGray4), in: RoundedRectangle(cornerRadius: 8))
            .foregroundStyle(.primary)
        }
    }
}

/// Botão 🌐 padrão: toque troca de teclado, segurar mostra a lista de teclados.
private struct GlobeButton: UIViewRepresentable {
    let controller: UIInputViewController

    func makeUIView(context: Context) -> UIButton {
        let button = UIButton(type: .system)
        button.setImage(UIImage(systemName: "globe"), for: .normal)
        button.tintColor = .label
        button.addTarget(
            controller,
            action: #selector(UIInputViewController.handleInputModeList(from:with:)),
            for: .allTouchEvents
        )
        return button
    }

    func updateUIView(_ uiView: UIButton, context: Context) {}
}
