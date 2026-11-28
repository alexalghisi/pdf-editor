import Foundation

struct RecentDocument: Codable, Identifiable, Equatable {
    var id: String { name }
    let name: String
    let bookmark: Data
}

struct RecentStore {
    static let key = "recentDocuments"
    static let limit = 6

    let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> [RecentDocument] {
        guard let data = defaults.data(forKey: Self.key) else { return [] }
        return (try? JSONDecoder().decode([RecentDocument].self, from: data)) ?? []
    }

    @discardableResult
    func remember(name: String, bookmark: Data) -> [RecentDocument] {
        var items = load().filter { $0.name != name }
        items.insert(RecentDocument(name: name, bookmark: bookmark), at: 0)
        items = Array(items.prefix(Self.limit))
        save(items)
        return items
    }

    @discardableResult
    func forget(name: String) -> [RecentDocument] {
        let items = load().filter { $0.name != name }
        save(items)
        return items
    }

    private func save(_ items: [RecentDocument]) {
        guard let data = try? JSONEncoder().encode(items) else { return }
        defaults.set(data, forKey: Self.key)
    }
}
