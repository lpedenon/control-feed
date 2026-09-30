import Foundation

/// The app's side of the shared settings: reading them for the screens and
/// stamping each change so that it wins over older copies in the extension.
public struct SettingsRepository: Sendable {
    private let store: any SettingsStoring
    private let catalog: Catalog
    private let now: @Sendable () -> Date

    public init(store: any SettingsStoring, catalog: Catalog = .shared, now: @escaping @Sendable () -> Date = { Date() }) {
        self.store = store
        self.catalog = catalog
        self.now = now
    }

    /// What is stored, or the defaults (never changed) when nothing is or it cannot be read.
    public func current() -> StoredSettings {
        let stored = (try? store.loadSettings()) ?? nil
        return stored ?? StoredSettings(settings: .defaults(catalog: catalog), updatedAt: 0)
    }

    /// Stores changed settings. The stamp is always later than the current one,
    /// even if the clock went backwards, so the change cannot lose to an older copy.
    @discardableResult
    public func save(_ settings: ExtensionSettings) throws -> StoredSettings {
        let previous = current().updatedAt
        let milliseconds = Int64((now().timeIntervalSince1970 * 1000).rounded())
        let stored = StoredSettings(settings: settings, updatedAt: max(milliseconds, previous + 1))
        try store.saveSettings(stored)
        return stored
    }
}
