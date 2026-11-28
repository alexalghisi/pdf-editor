import Observation
import PDFKit
import SwiftUI

@Observable
final class AppState {
    var editor: EditorModel?
    var errorMessage: String?
    private(set) var recents: [RecentDocument]

    @ObservationIgnored private let store: RecentStore

    init(store: RecentStore = RecentStore()) {
        self.store = store
        self.recents = store.load()
    }

    func open(url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer {
            if scoped {
                url.stopAccessingSecurityScopedResource()
            }
        }
        guard let data = try? Data(contentsOf: url) else {
            errorMessage = "The file could not be read."
            return
        }
        guard open(data: data, name: url.lastPathComponent) else { return }
        if let bookmark = try? url.bookmarkData() {
            recents = store.remember(name: url.lastPathComponent, bookmark: bookmark)
        }
    }

    func open(recent: RecentDocument) {
        var stale = false
        guard let url = try? URL(resolvingBookmarkData: recent.bookmark, bookmarkDataIsStale: &stale) else {
            recents = store.forget(name: recent.name)
            errorMessage = "This file is no longer available."
            return
        }
        open(url: url)
    }

    func openSample() {
        guard let url = Bundle.main.url(forResource: "sample", withExtension: "pdf"),
            let data = try? Data(contentsOf: url)
        else {
            errorMessage = "The sample document is missing."
            return
        }
        open(data: data, name: "Service agreement.pdf")
    }

    @discardableResult
    func open(data: Data, name: String) -> Bool {
        guard let document = PDFDocument(data: data), document.pageCount > 0 else {
            errorMessage = "This file is not a PDF the app can open."
            return false
        }
        guard !document.isLocked else {
            errorMessage = "Password-protected PDFs are not supported yet."
            return false
        }
        editor = EditorModel(document: document, title: name)
        return true
    }

    func close() {
        editor = nil
    }
}
