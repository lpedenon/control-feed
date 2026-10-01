import Foundation

public enum AppRoute: String, CaseIterable, Sendable {
    case status
    case rules
    case gate
    case help

    public static let scheme = "nobrainrot"

    public init?(url: URL) {
        guard url.absoluteString.lowercased() == "\(Self.scheme)://rules" else { return nil }
        self = .rules
    }
}
