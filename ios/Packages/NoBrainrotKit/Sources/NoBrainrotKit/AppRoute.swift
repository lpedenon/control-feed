import Foundation

public enum AppRoute: String, CaseIterable, Sendable {
    case status
    case rules
    case gate
    case help

    public static let scheme = "nobrainrot"

    /// External routing is limited to the popup's `nobrainrot://rules` handoff.
    /// Compare the whole URL so extra paths, parameters and other tab routes are refused.
    public init?(url: URL) {
        guard url.absoluteString.lowercased() == "\(Self.scheme)://rules" else { return nil }
        self = .rules
    }
}
