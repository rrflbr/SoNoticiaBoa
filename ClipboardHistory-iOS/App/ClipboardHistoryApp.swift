import SwiftUI

@main
struct ClipboardHistoryApp: App {
    @StateObject private var model = HistoryModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .onAppear { model.refresh(capture: true) }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { model.refresh(capture: true) }
                }
        }
    }
}

@MainActor
final class HistoryModel: ObservableObject {
    @Published private(set) var items: [ClipItem] = []
    private let store = ClipboardStore.shared

    func refresh(capture: Bool) {
        if capture { PasteboardCapture.captureIfChanged(store: store) }
        items = store.items()
    }

    func copy(_ item: ClipItem) {
        PasteboardCapture.write(item.text, store: store)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    func remove(_ item: ClipItem) {
        store.remove(id: item.id)
        refresh(capture: false)
    }

    func clear() {
        store.clear()
        refresh(capture: false)
    }
}
