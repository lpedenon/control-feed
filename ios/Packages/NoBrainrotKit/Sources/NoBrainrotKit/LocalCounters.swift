import Foundation

/// Counts of what the person did on this app's own screens, kept on the phone.
/// The app cannot see Safari, the YouTube app or anything watched, so these
/// are not usage figures and are never named as such. Every change returns a
/// new value.
public struct LocalCounters: Codable, Equatable, Sendable {
    /// When counting began on this phone.
    public let since: Date
    /// Taps on "Open YouTube in Safari" that iOS accepted.
    public let safariOpens: Int
    /// Rule changes saved in this app.
    public let ruleChanges: Int
    /// "Hide" switches, or the whole site, turned off in this app.
    public let hidingSwitchesTurnedOff: Int

    public init(since: Date, safariOpens: Int = 0, ruleChanges: Int = 0, hidingSwitchesTurnedOff: Int = 0) {
        self.since = since
        self.safariOpens = safariOpens
        self.ruleChanges = ruleChanges
        self.hidingSwitchesTurnedOff = hidingSwitchesTurnedOff
    }

    public func countingSafariOpen() -> LocalCounters {
        LocalCounters(
            since: since,
            safariOpens: safariOpens + 1,
            ruleChanges: ruleChanges,
            hidingSwitchesTurnedOff: hidingSwitchesTurnedOff
        )
    }

    public func countingChange(from old: ExtensionSettings, to new: ExtensionSettings) -> LocalCounters {
        LocalCounters(
            since: since,
            safariOpens: safariOpens,
            ruleChanges: ruleChanges + 1,
            hidingSwitchesTurnedOff: hidingSwitchesTurnedOff
                + Self.turnedOff(old.sites, new.sites)
                + Self.turnedOff(old.features, new.features)
        )
    }

    public struct Row: Equatable, Identifiable, Sendable {
        public let label: String
        public let count: Int
        public var id: String { label }
    }

    /// The labelled counts, in the order they are shown and exported.
    public var rows: [Row] {
        [
            Row(label: "Opened YouTube in Safari from this app", count: safariOpens),
            Row(label: "Rule changes saved in this app", count: ruleChanges),
            Row(label: "Hiding switches turned off in this app", count: hidingSwitchesTurnedOff),
        ]
    }

    public static let scopeNote =
        "Only what you do in the No Brainrot app is counted. It cannot see Safari, the YouTube app or what you watch."

    /// The totals as plain text for the person to share themselves. Nothing but
    /// the counts and the period they cover.
    public func exportText(until now: Date) -> String {
        let format = ISO8601DateFormatter()
        let lines = ["No Brainrot counters", "From \(format.string(from: since)) to \(format.string(from: now))"]
            + rows.map { "\($0.label): \($0.count)" }
            + [Self.scopeNote]
        return lines.joined(separator: "\n")
    }

    private static func turnedOff(_ old: [String: Bool], _ new: [String: Bool]) -> Int {
        old.filter { $0.value && new[$0.key] == false }.count
    }
}
