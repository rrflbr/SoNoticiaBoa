import SwiftUI
import UIKit

/// Campo de texto que acrescenta “Colar expandido” ao menu de edição
/// (o que aparece ao segurar o cursor), ao lado de “Colar”.
///
/// IMPORTANTE: o iOS só permite personalizar esse menu nos campos do PRÓPRIO app.
/// Em outros apps, use o teclado Clip 10.
struct PasteField: UIViewRepresentable {
    @Binding var text: String

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.delegate = context.coordinator
        view.font = .preferredFont(forTextStyle: .body)
        view.backgroundColor = .secondarySystemBackground
        view.layer.cornerRadius = 12
        view.textContainerInset = UIEdgeInsets(top: 12, left: 8, bottom: 12, right: 8)
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
        if view.text != text { view.text = text }
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: PasteField

        init(_ parent: PasteField) { self.parent = parent }

        func textViewDidChange(_ textView: UITextView) {
            parent.text = textView.text
        }

        func textView(
            _ textView: UITextView,
            editMenuForTextIn range: NSRange,
            suggestedActions: [UIMenuElement]
        ) -> UIMenu? {
            let items = ClipboardStore.shared.items()
            guard !items.isEmpty else { return UIMenu(children: suggestedActions) }

            let entries = items.map { item in
                UIAction(title: item.preview) { [weak textView] _ in
                    textView?.insertText(item.text)
                }
            }
            let expanded = UIMenu(
                title: "Colar expandido",
                image: UIImage(systemName: "doc.on.clipboard"),
                children: entries
            )
            return UIMenu(children: suggestedActions + [expanded])
        }
    }
}
