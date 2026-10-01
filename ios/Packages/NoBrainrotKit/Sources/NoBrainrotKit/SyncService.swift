import Foundation

/// Answers the extension. Whichever side changed the settings last wins: the
/// extension's settings replace the app's only when they are newer, and the
/// answer always carries what the app holds afterwards. Every exchange is
/// recorded so the app can say honestly what it last heard.
public struct SyncService: Sendable {
    private let settingsStore: any SettingsStoring
    private let contactStore: any ContactStoring
    private let appVersion: String
    private let catalog: Catalog
    private let now: @Sendable () -> Date

    public init(
        settingsStore: any SettingsStoring,
        contactStore: any ContactStoring,
        appVersion: String,
        catalog: Catalog = .shared,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.settingsStore = settingsStore
        self.contactStore = contactStore
        self.appVersion = appVersion
        self.catalog = catalog
        self.now = now
    }

    /// Handles a raw message and always returns a JSON answer, never throws.
    public func handle(_ raw: JSONValue?) -> JSONValue {
        let response = respond(to: raw)
        do {
            return try response.toJSON()
        } catch {
            return .object(["ok": .bool(false), "error": .string(SyncRefusal.storageFailed.rawValue)])
        }
    }

    public func respond(to raw: JSONValue?) -> SyncResponse {
        let request: SyncRequest
        switch SyncRequest.parse(raw, catalog: catalog) {
        case .success(let parsed): request = parsed
        case .failure(let refusal): return .refused(refusal)
        }

        let held: StoredSettings
        do {
            held = try reconcile(request)
        } catch {
            return .refused(.storageFailed)
        }
        record(request, delivered: held.updatedAt)
        return .accepted(appVersion: appVersion, settings: held.settings, settingsUpdatedAt: held.updatedAt)
    }

    /// The settings the app holds after weighing the extension's against its own.
    private func reconcile(_ request: SyncRequest) throws -> StoredSettings {
        let extensionCopy = StoredSettings(settings: request.settings, updatedAt: request.settingsUpdatedAt)
        // A store that cannot be read is treated as empty: the extension's copy is better than none.
        let held = (try? settingsStore.loadSettings()) ?? nil
        guard let held else {
            try settingsStore.saveSettings(extensionCopy)
            return extensionCopy
        }
        if request.settingsUpdatedAt > held.updatedAt {
            try settingsStore.saveSettings(extensionCopy)
            return extensionCopy
        }
        return held
    }

    private func record(_ request: SyncRequest, delivered: Int64) {
        let previous = contactStore.loadContact()
        let at = now()
        let sawPage = request.reason == .page
        contactStore.saveContact(ContactRecord(
            lastContactAt: at,
            extensionVersion: request.extensionVersion,
            siteAccess: request.siteAccess,
            lastPageAt: sawPage ? at : previous?.lastPageAt,
            lastPageHost: sawPage ? request.pageHost : previous?.lastPageHost,
            extensionSettingsUpdatedAt: request.settingsUpdatedAt,
            deliveredSettingsUpdatedAt: delivered
        ))
    }
}

extension SyncService {
    /// For the Safari extension handler: takes the message as Safari delivers
    /// it and returns the answer as Foundation objects, whatever the message was.
    public func handle(foundation message: Any?) -> Any {
        do {
            return try handle(try JSONValue(foundation: message)).foundationObject()
        } catch {
            return ["ok": false, "error": SyncRefusal.invalidRequest.rawValue] as [String: Any]
        }
    }
}
