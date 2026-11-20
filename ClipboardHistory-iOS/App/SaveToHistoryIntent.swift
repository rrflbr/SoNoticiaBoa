import AppIntents

/// Ação para o app Atalhos: salva um texto no histórico sem abrir o app.
/// Use depois de “Obter Área de Transferência”.
struct SaveToHistoryIntent: AppIntent {
    static let title: LocalizedStringResource = "Salvar no histórico"
    static let description = IntentDescription(
        "Salva um texto no histórico de 10 itens do Clip 10."
    )
    static let openAppWhenRun = false

    @Parameter(title: "Texto")
    var text: String

    func perform() async throws -> some IntentResult {
        ClipboardStore.shared.add(text)
        return .result()
    }
}

struct ClipboardShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SaveToHistoryIntent(),
            phrases: ["Salvar no histórico do \(.applicationName)"],
            shortTitle: "Salvar no histórico",
            systemImageName: "doc.on.clipboard"
        )
    }
}
