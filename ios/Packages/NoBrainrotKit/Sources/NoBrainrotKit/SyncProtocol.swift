import Foundation

/// How the Safari extension talks to the app. The TypeScript side is
/// `src/native/protocol.ts`; the generated contract carries the version and examples
/// of both messages that each side's tests check.
public enum SyncProtocol {
    public static let version = 1
    /// Longest version label taken from the extension.
    static let maxVersionLength = 64
}

/// Why the extension got in touch: its background page started, or a content
/// script ran on a supported page.
public enum ContactReason: String, Codable, CaseIterable, Sendable {
    case startup
    case page
}

/// What Safari reports about the extension's access to a site.
public enum SiteAccess: String, Codable, CaseIterable, Sendable {
    case granted
    case notGranted = "not-granted"
    case unknown
}

public enum SyncRefusal: String, Error, Equatable, Sendable {
    case invalidRequest = "invalid-request"
    case unsupportedProtocol = "unsupported-protocol"
    case storageFailed = "storage-failed"
}

/// One message from the extension. It carries no address, title or other
/// content the person is looking at.
public struct SyncRequest: Equatable, Sendable {
    public let extensionVersion: String
    public let reason: ContactReason
    public let settings: ExtensionSettings
    public let settingsUpdatedAt: Int64
    public let siteAccess: [String: SiteAccess]
    public let pageHost: String?

    public static func parse(_ raw: JSONValue?, catalog: Catalog = .shared) -> Result<SyncRequest, SyncRefusal> {
        guard case .object(let message)? = raw, message["type"]?.stringValue == "sync" else {
            return .failure(.invalidRequest)
        }
        guard let version = message["protocolVersion"]?.int64Value else { return .failure(.invalidRequest) }
        guard version == Int64(SyncProtocol.version) else { return .failure(.unsupportedProtocol) }
        guard let reason = message["reason"]?.stringValue.flatMap(ContactReason.init(rawValue:)) else {
            return .failure(.invalidRequest)
        }

        let access = message["siteAccess"]?.objectValue ?? [:]
        let pageHost = message["pageHost"]?.stringValue.flatMap { catalog.siteHosts.contains($0) ? $0 : nil }
        let extensionVersion = message["extensionVersion"]?.stringValue
            .flatMap { $0.count <= SyncProtocol.maxVersionLength ? $0 : nil } ?? "unknown"
        return .success(SyncRequest(
            extensionVersion: extensionVersion,
            reason: reason,
            settings: ExtensionSettings.parse(message["settings"], catalog: catalog),
            settingsUpdatedAt: max(0, message["settingsUpdatedAt"]?.int64Value ?? 0),
            siteAccess: Dictionary(uniqueKeysWithValues: catalog.siteHosts.map {
                ($0, access[$0]?.stringValue.flatMap(SiteAccess.init(rawValue:)) ?? .unknown)
            }),
            pageHost: pageHost
        ))
    }
}

/// The app's answer.
public enum SyncResponse: Equatable, Sendable {
    case accepted(appVersion: String, settings: ExtensionSettings, settingsUpdatedAt: Int64)
    case refused(SyncRefusal)

    public func toJSON() throws -> JSONValue {
        switch self {
        case .accepted(let appVersion, let settings, let updatedAt):
            return .object([
                "ok": .bool(true),
                "protocolVersion": .number(Double(SyncProtocol.version)),
                "appVersion": .string(appVersion),
                "settings": try settings.toJSON(),
                "settingsUpdatedAt": .number(Double(updatedAt)),
            ])
        case .refused(let refusal):
            return .object(["ok": .bool(false), "error": .string(refusal.rawValue)])
        }
    }
}
