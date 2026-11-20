import Foundation

/// Um item do histórico de área de transferência.
struct ClipItem: Codable, Identifiable, Equatable {
    var id = UUID()
    var text: String
    var date = Date()

    /// Texto em uma linha só, para menus e linhas compactas.
    var preview: String {
        let oneLine = text
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        return oneLine.count > 40 ? String(oneLine.prefix(40)) + "…" : oneLine
    }
}

/// Guarda os últimos `maxItems` textos copiados.
/// Usa um App Group para que o app e o teclado enxerguem a mesma lista.
final class ClipboardStore {
    static let appGroupID = "group.com.sonoticiaboa.clipboardhistory"
    static let maxItems = 10
    static let maxLength = 20_000

    static let shared = ClipboardStore(
        defaults: UserDefaults(suiteName: appGroupID) ?? .standard
    )

    private let defaults: UserDefaults
    private let itemsKey = "clipboard.items.v1"
    private let changeCountKey = "clipboard.lastChangeCount"
    private let lock = NSLock()

    init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    /// Itens do mais novo para o mais antigo.
    func items() -> [ClipItem] {
        guard
            let data = defaults.data(forKey: itemsKey),
            let items = try? JSONDecoder().decode([ClipItem].self, from: data)
        else { return [] }
        return items
    }

    /// Adiciona um texto no topo. Texto repetido sobe para o topo em vez de duplicar.
    /// - Returns: `true` se a lista mudou.
    @discardableResult
    func add(_ raw: String) -> Bool {
        let text = String(raw.prefix(Self.maxLength))
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }

        lock.lock()
        defer { lock.unlock() }

        var list = items()
        if list.first?.text == text { return false }
        list.removeAll { $0.text == text }
        list.insert(ClipItem(text: text), at: 0)
        save(Array(list.prefix(Self.maxItems)))
        return true
    }

    func remove(id: UUID) {
        lock.lock()
        defer { lock.unlock() }
        save(items().filter { $0.id != id })
    }

    func clear() {
        lock.lock()
        defer { lock.unlock() }
        save([])
    }

    /// Último `changeCount` do UIPasteboard que já foi processado.
    var lastSeenChangeCount: Int {
        get { defaults.integer(forKey: changeCountKey) }
        set { defaults.set(newValue, forKey: changeCountKey) }
    }

    private func save(_ items: [ClipItem]) {
        guard let data = try? JSONEncoder().encode(items) else { return }
        defaults.set(data, forKey: itemsKey)
    }
}
