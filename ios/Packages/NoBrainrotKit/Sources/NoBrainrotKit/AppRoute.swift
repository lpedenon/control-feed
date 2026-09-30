import Foundation

/// A screen of the app that a link can open, for example from the extension's
/// toolbar popup: `nobrainrot://rules`.
public enum AppRoute: String, CaseIterable, Sendable {
    case status
    case rules
    case gate
    case help

    public static let scheme = "nobrainrot"

    public init?(url: URL) {
        guard url.scheme?.lowercased() == Self.scheme, let host = url.host?.lowercased() else { return nil }
        self.init(rawValue: host)
    }
}
