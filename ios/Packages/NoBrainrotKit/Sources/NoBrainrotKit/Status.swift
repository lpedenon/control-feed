import Foundation

/// What the app can say about the Safari extension, from the only signal it
/// has: the extension getting in touch. iOS gives an app no way to look at
/// Safari's settings, so every state is worded as what was last reported.
public enum ExtensionState: Equatable, Sendable {
    /// Never heard from the extension.
    case neverSeen
    /// A content script ran on a supported page recently.
    case ranRecently(at: Date, host: String?)
    /// Heard from the extension, but it has not run on a page lately (or ever).
    case quiet(lastPage: Date?, lastContact: Date)
    /// The extension is running but Safari says it may not read YouTube.
    case siteAccessMissing(lastContact: Date)
}

/// Whether the latest change to the rules has reached the extension.
public enum SettingsDelivery: Equatable, Sendable {
    /// The rules were never changed: the extension's own defaults apply.
    case defaultsInUse
    /// The extension reported holding the latest rules.
    case confirmed
    /// Handed to the extension; it has not reported back since.
    case delivered
    /// The extension has not asked for them yet.
    case waiting
}

public enum StatusLevel: Equatable, Sendable {
    case notSetUp
    case working
    case needsAttention
}

public struct StatusReport: Equatable, Sendable {
    public let level: StatusLevel
    public let extensionState: ExtensionState
    public let delivery: SettingsDelivery
    /// Hosts Safari says the extension may not read, and hosts it could not say anything about.
    public let hostsWithoutAccess: [String]
    public let hostsWithUnknownAccess: [String]
    public let youtubeAppInstalled: Bool?
    /// The person's own note that the Shortcuts automation is set up; the app cannot check.
    public let gateMarkedSetUp: Bool

    /// How long after the extension last ran on a page it still counts as recent.
    public static let recentWindow: TimeInterval = 7 * 24 * 60 * 60
    /// The site the extension is built for on iPhone.
    public static let primaryHost = "m.youtube.com"

    public static func make(
        contact: ContactRecord?,
        settings: StoredSettings,
        gateMarkedSetUp: Bool,
        youtubeAppInstalled: Bool?,
        now: Date
    ) -> StatusReport {
        let state = extensionState(contact: contact, now: now)
        let level: StatusLevel = switch state {
        case .neverSeen: .notSetUp
        case .ranRecently: .working
        case .quiet, .siteAccessMissing: .needsAttention
        }
        return StatusReport(
            level: level,
            extensionState: state,
            delivery: delivery(contact: contact, settings: settings),
            hostsWithoutAccess: hosts(in: contact, matching: .notGranted),
            hostsWithUnknownAccess: hosts(in: contact, matching: .unknown),
            youtubeAppInstalled: youtubeAppInstalled,
            gateMarkedSetUp: gateMarkedSetUp
        )
    }

    private static func extensionState(contact: ContactRecord?, now: Date) -> ExtensionState {
        guard let contact else { return .neverSeen }
        if contact.siteAccess[primaryHost] == .notGranted {
            return .siteAccessMissing(lastContact: contact.lastContactAt)
        }
        if let page = contact.lastPageAt, now.timeIntervalSince(page) <= recentWindow {
            return .ranRecently(at: page, host: contact.lastPageHost)
        }
        return .quiet(lastPage: contact.lastPageAt, lastContact: contact.lastContactAt)
    }

    private static func delivery(contact: ContactRecord?, settings: StoredSettings) -> SettingsDelivery {
        guard settings.updatedAt > 0 else { return .defaultsInUse }
        guard let contact else { return .waiting }
        if contact.extensionSettingsUpdatedAt >= settings.updatedAt { return .confirmed }
        if contact.deliveredSettingsUpdatedAt >= settings.updatedAt { return .delivered }
        return .waiting
    }

    private static func hosts(in contact: ContactRecord?, matching access: SiteAccess) -> [String] {
        (contact?.siteAccess ?? [:]).filter { $0.value == access }.map(\.key).sorted()
    }
}

/// The words shown for a status. Kept here, next to the logic, so tests can
/// hold them to the honesty rules: never "protected", always what was reported.
public struct StatusCopy: Equatable, Sendable {
    public let headline: String
    public let detail: String
    /// What the status does not cover.
    public let footnote: String
    public let deliveryLine: String?

    public static let footnote =
        "This is what the extension last reported. It says nothing about the YouTube app, other browsers or other sites, and Safari can switch the extension off at any time."

    /// - Parameter relative: turns a date into words such as "3 hours ago".
    public static func make(from report: StatusReport, relative: (Date) -> String) -> StatusCopy {
        let headline: String
        let detail: String
        switch report.extensionState {
        case .neverSeen:
            headline = "Not set up yet"
            detail = "The Safari extension has not been in touch. Follow the setup steps, then open m.youtube.com in Safari."
        case .ranRecently(let date, _):
            headline = "Seen working in Safari \(relative(date))"
            detail = "The extension last ran on a YouTube page in Safari \(relative(date))."
        case .quiet(let lastPage, let lastContact):
            headline = "Not seen on YouTube lately"
            if let lastPage {
                detail = "The extension last ran on a YouTube page \(relative(lastPage)). If you have used YouTube in Safari since, check that the extension is still switched on."
            } else {
                detail = "Safari started the extension \(relative(lastContact)), but it has not run on a YouTube page yet. Open m.youtube.com in Safari."
            }
        case .siteAccessMissing(let lastContact):
            headline = "Safari has not allowed YouTube"
            detail = "As of \(relative(lastContact)), Safari reported that the extension may not read m.youtube.com, so it cannot change the page. Allow it in Safari's extension settings."
        }

        let deliveryLine: String? = switch report.delivery {
        case .defaultsInUse: nil
        case .confirmed: "Your latest rules are in Safari's extension."
        case .delivered: "Your latest rules were sent to the extension. It has not confirmed them yet."
        case .waiting: "Your latest rules reach Safari the next time you open YouTube there."
        }

        var notes: [String] = []
        // When the headline is already about missing access, the list would only repeat it.
        var accessIsTheHeadline = false
        if case .siteAccessMissing = report.extensionState { accessIsTheHeadline = true }
        if !report.hostsWithoutAccess.isEmpty, !accessIsTheHeadline {
            notes.append("Not allowed on: \(report.hostsWithoutAccess.joined(separator: ", ")).")
        }
        if !report.hostsWithUnknownAccess.isEmpty {
            notes.append("Safari did not say whether these are allowed: \(report.hostsWithUnknownAccess.joined(separator: ", ")).")
        }
        return StatusCopy(
            headline: headline,
            detail: ([detail] + notes).joined(separator: " "),
            footnote: footnote,
            deliveryLine: deliveryLine
        )
    }
}
