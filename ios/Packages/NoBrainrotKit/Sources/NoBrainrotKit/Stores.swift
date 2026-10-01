import Foundation

/// The settings as stored, with the time of the change that made them.
public struct StoredSettings: Equatable, Sendable {
    public let settings: ExtensionSettings
    /// Milliseconds since 1970 of the latest change; the later change wins on sync.
    public let updatedAt: Int64

    public init(settings: ExtensionSettings, updatedAt: Int64) {
        self.settings = settings
        self.updatedAt = updatedAt
    }
}

/// What the app last heard from the extension. Everything here is reported by
/// the extension itself, so it says what the extension claimed, not what Safari does.
public struct ContactRecord: Codable, Equatable, Sendable {
    public var lastContactAt: Date
    public var extensionVersion: String
    public var siteAccess: [String: SiteAccess]
    /// When a content script last ran on a supported page.
    public var lastPageAt: Date?
    public var lastPageHost: String?
    /// The version of the settings the extension held when it last got in touch.
    public var extensionSettingsUpdatedAt: Int64
    /// The version of the settings the app last handed to the extension.
    public var deliveredSettingsUpdatedAt: Int64

    public init(
        lastContactAt: Date,
        extensionVersion: String,
        siteAccess: [String: SiteAccess],
        lastPageAt: Date?,
        lastPageHost: String?,
        extensionSettingsUpdatedAt: Int64,
        deliveredSettingsUpdatedAt: Int64
    ) {
        self.lastContactAt = lastContactAt
        self.extensionVersion = extensionVersion
        self.siteAccess = siteAccess
        self.lastPageAt = lastPageAt
        self.lastPageHost = lastPageHost
        self.extensionSettingsUpdatedAt = extensionSettingsUpdatedAt
        self.deliveredSettingsUpdatedAt = deliveredSettingsUpdatedAt
    }
}

public protocol SettingsStoring: Sendable {
    func loadSettings() throws -> StoredSettings?
    func saveSettings(_ stored: StoredSettings) throws
}

public protocol ContactStoring: Sendable {
    func loadContact() -> ContactRecord?
    func saveContact(_ record: ContactRecord)
}

/// Storage shared between the app and its Safari extension through an App
/// Group, or any `UserDefaults` for tests. Both sides use the same keys.
public final class SharedDefaultsStore: SettingsStoring, ContactStoring, @unchecked Sendable {
    static let settingsKey = "settings.v1"
    static let contactKey = "contact.v1"

    private let defaults: UserDefaults

    public init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    /// The store for an App Group, or nil when the group is not available to this process.
    /// A process without the App Group entitlement still gets a defaults object
    /// from `UserDefaults`, but one the other process cannot see, so the group's
    /// shared container is checked too.
    public static func appGroup(_ identifier: String) -> SharedDefaultsStore? {
        guard !identifier.isEmpty,
              FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier) != nil
        else { return nil }
        return UserDefaults(suiteName: identifier).map(SharedDefaultsStore.init(defaults:))
    }

    public func loadSettings() throws -> StoredSettings? {
        guard let data = defaults.data(forKey: Self.settingsKey) else { return nil }
        let raw = try JSONDecoder().decode(JSONValue.self, from: data)
        // Read leniently, so a file written by another version can still be repaired.
        guard let updatedAt = raw["updatedAt"]?.int64Value else { return nil }
        return StoredSettings(settings: ExtensionSettings.parse(raw["settings"]), updatedAt: max(0, updatedAt))
    }

    public func saveSettings(_ stored: StoredSettings) throws {
        let document = JSONValue.object([
            "settings": try stored.settings.toJSON(),
            "updatedAt": .number(Double(stored.updatedAt)),
        ])
        defaults.set(try JSONEncoder().encode(document), forKey: Self.settingsKey)
    }

    public func loadContact() -> ContactRecord? {
        guard let data = defaults.data(forKey: Self.contactKey) else { return nil }
        return try? Self.decoder.decode(ContactRecord.self, from: data)
    }

    public func saveContact(_ record: ContactRecord) {
        guard let data = try? Self.encoder.encode(record) else { return }
        defaults.set(data, forKey: Self.contactKey)
    }

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        return decoder
    }()
}
