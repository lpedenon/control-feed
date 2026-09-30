import Foundation
import Observation

/// Opens an address outside the app. The real one hands it to the system;
/// tests use a fake.
public protocol URLOpening: Sendable {
    /// Whether the system accepted the address.
    @MainActor func open(_ url: URL) async -> Bool
}

public struct AppDependencies {
    public let repository: SettingsRepository
    public let contacts: any ContactStoring
    /// False when the storage shared with the Safari extension cannot be reached.
    public let sharedStorageAvailable: Bool
    public let opener: any URLOpening
    /// Whether the YouTube app is on this iPhone, or nil when that cannot be told.
    public let youtubeAppInstalled: @MainActor () -> Bool?
    /// Small notes of the person's own that never leave the app.
    public let preferences: UserDefaults
    public let now: @Sendable () -> Date

    public init(
        repository: SettingsRepository,
        contacts: any ContactStoring,
        sharedStorageAvailable: Bool,
        opener: any URLOpening,
        youtubeAppInstalled: @escaping @MainActor () -> Bool?,
        preferences: UserDefaults,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.repository = repository
        self.contacts = contacts
        self.sharedStorageAvailable = sharedStorageAvailable
        self.opener = opener
        self.youtubeAppInstalled = youtubeAppInstalled
        self.preferences = preferences
        self.now = now
    }
}

/// What every screen shows and changes. The views hold no logic of their own.
@MainActor
@Observable
public final class AppModel {
    public static let cleanYouTubeURL = URL(string: "https://m.youtube.com/")!
    static let setupSeenKey = "setupSeen"
    static let gateMarkedKey = "gateMarkedSetUp"
    static let countersKey = "counters.v1"

    public private(set) var settings: ExtensionSettings
    public private(set) var status: StatusReport
    public private(set) var saveFailure: String?
    public private(set) var launchFailure: String?
    public private(set) var setupSeen: Bool
    public private(set) var gateMarkedSetUp: Bool
    public private(set) var counters: LocalCounters
    public var sharedStorageAvailable: Bool { dependencies.sharedStorageAvailable }

    @ObservationIgnored private let dependencies: AppDependencies

    public init(dependencies: AppDependencies) {
        self.dependencies = dependencies
        let stored = dependencies.repository.current()
        let gate = dependencies.preferences.bool(forKey: Self.gateMarkedKey)
        settings = stored.settings
        gateMarkedSetUp = gate
        setupSeen = dependencies.preferences.bool(forKey: Self.setupSeenKey)
        let saved = dependencies.preferences.data(forKey: Self.countersKey)
            .flatMap { try? JSONDecoder().decode(LocalCounters.self, from: $0) }
        counters = saved ?? LocalCounters(since: dependencies.now())
        status = StatusReport.make(
            contact: dependencies.contacts.loadContact(),
            settings: stored,
            gateMarkedSetUp: gate,
            youtubeAppInstalled: dependencies.youtubeAppInstalled(),
            now: dependencies.now()
        )
        // Saved at once, so the date counting began stays put until something is counted.
        if saved == nil { saveCounters() }
    }

    /// Reads everything again. The extension can adopt newer settings and report
    /// in while the app is in the background, so this runs whenever the app comes forward.
    public func refresh() {
        let stored = dependencies.repository.current()
        settings = stored.settings
        status = StatusReport.make(
            contact: dependencies.contacts.loadContact(),
            settings: stored,
            gateMarkedSetUp: gateMarkedSetUp,
            youtubeAppInstalled: dependencies.youtubeAppInstalled(),
            now: dependencies.now()
        )
    }

    /// Applies a change to the rules and saves it at once. If it cannot be
    /// saved the screens go back to what is stored and the failure is shown.
    public func change(_ edit: (ExtensionSettings) -> ExtensionSettings) {
        let next = edit(settings)
        guard next != settings else { return }
        do {
            try dependencies.repository.save(next)
            saveFailure = nil
            count(counters.countingChange(from: settings, to: next))
        } catch {
            saveFailure = "Your change could not be saved. Try again."
        }
        refresh()
    }

    public func dismissSaveFailure() {
        saveFailure = nil
    }

    public func openCleanYouTube() async {
        launchFailure = nil
        let opened = await dependencies.opener.open(Self.cleanYouTubeURL)
        if opened {
            count(counters.countingSafariOpen())
        } else {
            launchFailure = "Safari could not be opened. Open m.youtube.com in Safari yourself."
        }
    }

    public func dismissLaunchFailure() {
        launchFailure = nil
    }

    public func setGateMarked(_ marked: Bool) {
        dependencies.preferences.set(marked, forKey: Self.gateMarkedKey)
        gateMarkedSetUp = marked
        refresh()
    }

    public func finishSetup() {
        dependencies.preferences.set(true, forKey: Self.setupSeenKey)
        setupSeen = true
    }

    /// The counters as plain text, for the person to share when they ask to.
    public func countersExport() -> String {
        counters.exportText(until: dependencies.now())
    }

    private func count(_ next: LocalCounters) {
        counters = next
        saveCounters()
    }

    private func saveCounters() {
        dependencies.preferences.set(try? JSONEncoder().encode(counters), forKey: Self.countersKey)
    }

    /// The words for the current status; `relative` turns a date into "3 hours ago".
    public func statusCopy(relative: (Date) -> String) -> StatusCopy {
        StatusCopy.make(from: status, relative: relative)
    }
}
