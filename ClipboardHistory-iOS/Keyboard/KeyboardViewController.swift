import UIKit
import SwiftUI

final class KeyboardViewController: UIInputViewController {
    private lazy var model = KeyboardModel(controller: self)

    override func viewDidLoad() {
        super.viewDidLoad()

        let host = UIHostingController(rootView: KeyboardView(model: model, controller: self))
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.backgroundColor = .clear
        addChild(host)
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        host.didMove(toParent: self)

        let height = view.heightAnchor.constraint(equalToConstant: 300)
        height.priority = .defaultHigh
        height.isActive = true
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        model.refresh()
    }
}

/// Estado do teclado: lista, modo expandido e ações de digitação.
final class KeyboardModel: ObservableObject {
    @Published var items: [ClipItem] = []
    @Published var expanded = false
    @Published var hasFullAccess = false

    private weak var controller: UIInputViewController?

    init(controller: UIInputViewController) {
        self.controller = controller
    }

    func refresh() {
        hasFullAccess = controller?.hasFullAccess ?? false
        guard hasFullAccess else { items = []; return }
        // Registra o que foi copiado desde a última vez que o teclado apareceu.
        PasteboardCapture.captureIfChanged()
        items = ClipboardStore.shared.items()
    }

    var proxy: UITextDocumentProxy? { controller?.textDocumentProxy }

    func paste(_ item: ClipItem) {
        proxy?.insertText(item.text)
        expanded = false
    }

    func insertSpace() { proxy?.insertText(" ") }
    func insertReturn() { proxy?.insertText("\n") }
    func deleteBackward() { proxy?.deleteBackward() }
}
