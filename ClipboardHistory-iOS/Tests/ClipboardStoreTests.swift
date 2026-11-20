import XCTest

final class ClipboardStoreTests: XCTestCase {
    private var store: ClipboardStore!

    override func setUp() {
        let suite = "test.\(UUID().uuidString)"
        store = ClipboardStore(defaults: UserDefaults(suiteName: suite)!)
    }

    func testKeepsOnlyLastTen() {
        for i in 1...15 { store.add("item \(i)") }
        let items = store.items()
        XCTAssertEqual(items.count, 10)
        XCTAssertEqual(items.first?.text, "item 15")
        XCTAssertEqual(items.last?.text, "item 6")
    }

    func testDuplicateMovesToTop() {
        store.add("a"); store.add("b"); store.add("c")
        XCTAssertTrue(store.add("a"))
        XCTAssertEqual(store.items().map(\.text), ["a", "c", "b"])
    }

    func testSameAsLatestIsIgnored() {
        store.add("a")
        XCTAssertFalse(store.add("a"))
        XCTAssertEqual(store.items().count, 1)
    }

    func testBlankIsIgnored() {
        XCTAssertFalse(store.add("   \n "))
        XCTAssertTrue(store.items().isEmpty)
    }

    func testRemoveAndClear() {
        store.add("a"); store.add("b")
        store.remove(id: store.items()[0].id)
        XCTAssertEqual(store.items().map(\.text), ["a"])
        store.clear()
        XCTAssertTrue(store.items().isEmpty)
    }

    func testPreviewIsSingleLineAndTruncated() {
        let item = ClipItem(text: "linha 1\n\nlinha 2 " + String(repeating: "x", count: 100))
        XCTAssertFalse(item.preview.contains("\n"))
        XCTAssertLessThanOrEqual(item.preview.count, 41)
    }
}
