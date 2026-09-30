import Foundation
import NoBrainrotKit

/// In-memory stand-ins for the shared App Group storage.
final class FakeStore: SettingsStoring, ContactStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var settings: StoredSettings?
    private var contact: ContactRecord?
    var failLoading = false
    var failSaving = false

    struct Failure: Error {}

    init(settings: StoredSettings? = nil, contact: ContactRecord? = nil) {
        self.settings = settings
        self.contact = contact
    }

    func loadSettings() throws -> StoredSettings? {
        lock.lock(); defer { lock.unlock() }
        if failLoading { throw Failure() }
        return settings
    }

    func saveSettings(_ stored: StoredSettings) throws {
        lock.lock(); defer { lock.unlock() }
        if failSaving { throw Failure() }
        settings = stored
    }

    func loadContact() -> ContactRecord? {
        lock.lock(); defer { lock.unlock() }
        return contact
    }

    func saveContact(_ record: ContactRecord) {
        lock.lock(); defer { lock.unlock() }
        contact = record
    }

    var storedSettings: StoredSettings? {
        lock.lock(); defer { lock.unlock() }
        return settings
    }
}

func requestJSON(
    settings: ExtensionSettings = .defaults(),
    settingsUpdatedAt: Int64 = 0,
    reason: String = "page",
    pageHost: String? = "m.youtube.com",
    siteAccess: [String: String] = ["m.youtube.com": "granted", "www.youtube.com": "granted"],
    protocolVersion: Int = SyncProtocol.version,
    extensionVersion: String = "0.2.0"
) throws -> JSONValue {
    .object([
        "type": .string("sync"),
        "protocolVersion": .number(Double(protocolVersion)),
        "extensionVersion": .string(extensionVersion),
        "reason": .string(reason),
        "settings": try settings.toJSON(),
        "settingsUpdatedAt": .number(Double(settingsUpdatedAt)),
        "siteAccess": .object(siteAccess.mapValues(JSONValue.string)),
        "pageHost": pageHost.map(JSONValue.string) ?? .null,
    ])
}
