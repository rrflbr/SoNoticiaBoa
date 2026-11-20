import UIKit

/// Lê a área de transferência do sistema e grava no histórico.
///
/// O iOS não avisa quando algo é copiado e não deixa apps ficarem
/// monitorando em segundo plano. Por isso a captura só acontece quando
/// `captureIfChanged()` é chamada (app aberto, teclado aparecendo ou atalho).
enum PasteboardCapture {

    /// Só lê o conteúdo se o `changeCount` mudou desde a última leitura.
    /// Ler `changeCount` e `hasStrings` não dispara o aviso "Permitir colar" do iOS 16+;
    /// só ler `.string` dispara, e isso é evitado quando nada mudou.
    @discardableResult
    static func captureIfChanged(store: ClipboardStore = .shared) -> Bool {
        let pasteboard = UIPasteboard.general
        let count = pasteboard.changeCount
        guard store.lastSeenChangeCount != count else { return false }
        store.lastSeenChangeCount = count

        guard pasteboard.hasStrings, let string = pasteboard.string else { return false }
        return store.add(string)
    }

    /// Copia um texto do histórico de volta para a área de transferência
    /// sem que a própria cópia seja registrada de novo.
    static func write(_ text: String, store: ClipboardStore = .shared) {
        UIPasteboard.general.string = text
        store.lastSeenChangeCount = UIPasteboard.general.changeCount
    }
}
