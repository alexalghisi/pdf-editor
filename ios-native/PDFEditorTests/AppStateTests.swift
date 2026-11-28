import XCTest
@testable import PDFEditor

final class AppStateTests: XCTestCase {
    private func makeStore() -> RecentStore {
        let name = "tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name) ?? .standard
        defaults.removePersistentDomain(forName: name)
        return RecentStore(defaults: defaults)
    }

    func testRecentsKeepTheNewestFirstWithoutDuplicates() {
        let store = makeStore()
        store.remember(name: "a.pdf", bookmark: Data([1]))
        store.remember(name: "b.pdf", bookmark: Data([2]))
        let items = store.remember(name: "a.pdf", bookmark: Data([3]))
        XCTAssertEqual(items.map(\.name), ["a.pdf", "b.pdf"])
        XCTAssertEqual(items.first?.bookmark, Data([3]))
    }

    func testRecentsAreCapped() {
        let store = makeStore()
        for index in 0..<10 {
            store.remember(name: "\(index).pdf", bookmark: Data())
        }
        XCTAssertEqual(store.load().count, RecentStore.limit)
        XCTAssertEqual(store.load().first?.name, "9.pdf")
    }

    func testForgettingARecent() {
        let store = makeStore()
        store.remember(name: "a.pdf", bookmark: Data())
        XCTAssertTrue(store.forget(name: "a.pdf").isEmpty)
    }

    func testOpeningTheBundledSample() {
        let state = AppState(store: makeStore())
        state.openSample()
        XCTAssertNotNil(state.editor)
        XCTAssertNil(state.errorMessage)
        XCTAssertGreaterThan(state.editor?.pageCount ?? 0, 0)
    }

    func testRejectingDataThatIsNotAPdf() {
        let state = AppState(store: makeStore())
        XCTAssertFalse(state.open(data: Data("not a pdf".utf8), name: "x.pdf"))
        XCTAssertNil(state.editor)
        XCTAssertNotNil(state.errorMessage)
    }

    func testClosingTheEditor() {
        let state = AppState(store: makeStore())
        state.openSample()
        state.close()
        XCTAssertNil(state.editor)
    }
}
