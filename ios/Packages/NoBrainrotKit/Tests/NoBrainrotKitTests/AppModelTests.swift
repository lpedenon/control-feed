import Foundation
import Testing
@testable import NoBrainrotKit

@MainActor
private final class FakeCopier: TextCopying {
    var copied: [String] = []
    func copy(_ text: String) {
        copied.append(text)
    }
}

private final class TestClock: @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date

    init(_ start: Date) {
        current = start
    }

    var now: Date { lock.withLock { current } }

    func advance(by seconds: TimeInterval) {
        lock.withLock { current += seconds }
    }
}

@MainActor
@Suite("App model")
struct AppModelTests {
    private struct Rig {
        let model: AppModel
        let store: FakeStore
        let copier: FakeCopier
        let preferences: UserDefaults
    }

    private func rig(
        stored: StoredSettings? = nil,
        contact: ContactRecord? = nil,
        youtubeAppInstalled: Bool? = nil,
        storageAvailable: Bool = true,
        preferences reused: UserDefaults? = nil,
        now: @escaping @Sendable () -> Date = { Date(timeIntervalSince1970: 1_700_000_100) }
    ) -> Rig {
        let store = FakeStore(settings: stored, contact: contact)
        let copier = FakeCopier()
        let preferences = reused ?? UserDefaults(suiteName: "no-brainrot-model-\(UUID().uuidString)")!
        let model = AppModel(dependencies: AppDependencies(
            repository: SettingsRepository(store: store, now: { Date(timeIntervalSince1970: 1_700_000_000) }),
            contacts: store,
            sharedStorageAvailable: storageAvailable,
            copier: copier,
            youtubeAppInstalled: { youtubeAppInstalled },
            preferences: preferences,
            now: now
        ))
        return Rig(model: model, store: store, copier: copier, preferences: preferences)
    }

    @Test func startsFromDefaultsAndNotSetUp() {
        let rig = rig()
        #expect(rig.model.settings == .defaults())
        #expect(rig.model.status.level == .notSetUp)
        #expect(!rig.model.setupSeen)
        #expect(!rig.model.gateMarkedSetUp)
    }

    @Test func aChangeIsSavedAtOnceAndStamped() {
        let rig = rig()
        rig.model.change { $0.settingFeature("ytShorts", enabled: false) }
        #expect(rig.model.settings.features["ytShorts"] == false)
        #expect(rig.store.storedSettings?.settings.features["ytShorts"] == false)
        #expect(rig.store.storedSettings?.updatedAt == 1_700_000_000_000)
        #expect(rig.model.status.delivery == .waiting)
    }

    @Test func aChangeThatChangesNothingSavesNothing() {
        let rig = rig()
        rig.model.change { $0 }
        #expect(rig.store.storedSettings == nil)
    }

    @Test func aFailedSaveGoesBackToWhatIsStoredAndSaysSo() {
        let rig = rig()
        rig.store.failSaving = true
        rig.model.change { $0.settingFeature("ytShorts", enabled: false) }
        #expect(rig.model.settings.features["ytShorts"] == true)
        #expect(rig.model.saveFailure != nil)
        rig.store.failSaving = false
        rig.model.change { $0.settingFeature("ytShorts", enabled: false) }
        #expect(rig.model.saveFailure == nil)
        #expect(rig.model.settings.features["ytShorts"] == false)
    }

    @Test func aFailureCanBeDismissed() {
        let rig = rig()
        rig.store.failSaving = true
        rig.model.change { $0.settingFeature("ytShorts", enabled: false) }
        rig.model.dismissSaveFailure()
        #expect(rig.model.saveFailure == nil)
    }

    @Test func refreshPicksUpSettingsTheExtensionAdopted() {
        let rig = rig()
        let fromSafari = ExtensionSettings.defaults().settingFeature("ytComments", enabled: true)
        try? rig.store.saveSettings(StoredSettings(settings: fromSafari, updatedAt: 9))
        rig.model.refresh()
        #expect(rig.model.settings == fromSafari)
    }

    @Test func refreshPicksUpAContactFromTheExtension() {
        let rig = rig()
        rig.store.saveContact(ContactRecord(
            lastContactAt: Date(timeIntervalSince1970: 1_700_000_050),
            extensionVersion: "0.2.0",
            siteAccess: ["m.youtube.com": .granted],
            lastPageAt: Date(timeIntervalSince1970: 1_700_000_050),
            lastPageHost: "m.youtube.com",
            extensionSettingsUpdatedAt: 0,
            deliveredSettingsUpdatedAt: 0
        ))
        rig.model.refresh()
        #expect(rig.model.status.level == .working)
    }

    @Test func copiesTheAddressWithoutClaimingSafariRan() {
        let rig = rig()
        let before = rig.model.status
        rig.model.copyCleanYouTubeAddress()
        #expect(rig.copier.copied == ["https://m.youtube.com/"])
        #expect(rig.model.status == before)
        #expect(rig.model.counters.addressCopies == 1)
        #expect(rig.model.counters.urlDispatches == 0)
    }

    @Test func emitsTheManualSafariFlowText() {
        #expect(SafariFlow.copyLabel == "Copy YouTube address")
        #expect(SafariFlow.copiedLabel == "Copied YouTube address")
        #expect(SafariFlow.instructions == "Copy the address, open Safari yourself, then paste it into Safari's address bar and go. No Brainrot works only in Safari with the extension enabled and allowed on YouTube. Copying does not open Safari or confirm protection.")
        #expect(SafariFlow.shortcutDescription == "An optional iPhone Shortcut can try to open the YouTube address when you open the YouTube app. Open URLs does not force Safari: your default browser or the YouTube app may open instead. For No Brainrot, use the manual Safari steps below. You can turn the automation off at any time; it is a nudge, not a lock.")
        #expect(SafariFlow.shortcutCheck == "Open the YouTube app and check where the automation sends you. If it opens another browser or returns to the YouTube app, it is not using No Brainrot. Turn the automation off and use the manual Safari steps instead. This app cannot check the destination.")
    }

    @Test func theGateNoteIsRememberedAndShownInTheStatus() {
        let rig = rig()
        rig.model.setGateMarked(true)
        #expect(rig.model.gateMarkedSetUp)
        #expect(rig.model.status.gateMarkedSetUp)
        #expect(rig.preferences.bool(forKey: AppModel.gateMarkedKey))
        rig.model.setGateMarked(false)
        #expect(!rig.model.status.gateMarkedSetUp)
    }

    @Test func finishingTheSetupIsRemembered() {
        let rig = rig()
        rig.model.finishSetup()
        #expect(rig.model.setupSeen)
        #expect(rig.preferences.bool(forKey: AppModel.setupSeenKey))
    }

    @Test func reportsWhetherTheYouTubeAppIsThere() {
        #expect(rig(youtubeAppInstalled: true).model.status.youtubeAppInstalled == true)
        #expect(rig(youtubeAppInstalled: false).model.status.youtubeAppInstalled == false)
        #expect(rig(youtubeAppInstalled: nil).model.status.youtubeAppInstalled == nil)
    }

    @Test func remembersThatSharedStorageIsMissing() {
        #expect(!rig(storageAvailable: false).model.sharedStorageAvailable)
        #expect(rig().model.sharedStorageAvailable)
    }

    @Test func producesTheStatusWords() {
        let copy = rig().model.statusCopy { _ in "now" }
        #expect(copy.headline == "Not set up yet")
    }

    @Test func countsEachCopyActionRatherThanSafariUse() {
        let rig = rig()
        rig.model.copyCleanYouTubeAddress()
        rig.model.copyCleanYouTubeAddress()
        #expect(rig.copier.copied == [SafariFlow.address, SafariFlow.address])
        #expect(rig.model.counters.addressCopies == 2)
        #expect(rig.model.counters.urlDispatches == 0)
    }

    @Test func preservesAndRelabelsTheLegacyHandoffCounts() throws {
        let since = Date(timeIntervalSince1970: 1_700_000_100)
        let preferences = UserDefaults(suiteName: "no-brainrot-legacy-\(UUID().uuidString)")!
        let legacy = try JSONSerialization.data(withJSONObject: [
            "since": since.timeIntervalSinceReferenceDate,
            "safariOpens": 7,
            "ruleChanges": 3,
            "hidingSwitchesTurnedOff": 2,
        ] as [String: Any])
        preferences.set(legacy, forKey: AppModel.countersKey)
        let first = rig(preferences: preferences)
        #expect(first.model.counters == LocalCounters(since: since, urlDispatches: 7, ruleChanges: 3, hidingSwitchesTurnedOff: 2))
        #expect(first.model.counters.rows[1] == LocalCounters.Row(label: "YouTube URL handoffs accepted by iOS (earlier app versions)", count: 7))
        first.model.copyCleanYouTubeAddress()
        first.model.change { $0.settingFeature("ytShorts", enabled: false) }
        let restarted = rig(preferences: preferences)
        #expect(restarted.model.counters == LocalCounters(since: since, urlDispatches: 7, addressCopies: 1, ruleChanges: 4, hidingSwitchesTurnedOff: 3))
        #expect(restarted.model.countersExportText() == """
        No Brainrot counters
        From 2023-11-14T22:15:00Z to 2023-11-14T22:15:00Z
        YouTube addresses copied in this app: 1
        YouTube URL handoffs accepted by iOS (earlier app versions): 7
        Rule changes saved in this app: 4
        Hiding switches turned off in this app: 3
        Only actions in the No Brainrot app are counted, not Safari use or protection. It cannot see Safari, the YouTube app or what you watch.
        """)
    }

    @Test func countsSavedRuleChangesAndTheHidingSwitchesTurnedOff() {
        let rig = rig()
        rig.model.change { $0.settingFeature("ytShorts", enabled: false) }
        rig.model.change { $0.settingFeature("ytComments", enabled: true) }
        rig.model.change { $0.settingSite("youtube", enabled: false) }
        #expect(rig.model.counters.ruleChanges == 3)
        #expect(rig.model.counters.hidingSwitchesTurnedOff == 2)
    }

    @Test func doesNotCountAChangeThatWasNotSaved() {
        let rig = rig()
        rig.model.change { $0 }
        rig.store.failSaving = true
        rig.model.change { $0.settingFeature("ytShorts", enabled: false) }
        #expect(rig.model.counters == LocalCounters(since: Date(timeIntervalSince1970: 1_700_000_100)))
    }

    @Test func theCountersAndWhenCountingBeganSurviveARestart() {
        let first = rig()
        first.model.copyCleanYouTubeAddress()
        first.model.change { $0.settingFeature("ytShorts", enabled: false) }
        let later = rig(preferences: first.preferences, now: { Date(timeIntervalSince1970: 1_800_000_000) })
        #expect(later.model.counters == first.model.counters)
        #expect(later.model.counters.since == Date(timeIntervalSince1970: 1_700_000_100))
    }

    @Test func exportsTheTotalsAndThePeriodOnly() {
        let rig = rig()
        rig.model.copyCleanYouTubeAddress()
        rig.model.change { $0.settingFeature("ytShorts", enabled: false) }
        #expect(rig.model.countersExportText() == """
        No Brainrot counters
        From 2023-11-14T22:15:00Z to 2023-11-14T22:15:00Z
        YouTube addresses copied in this app: 1
        YouTube URL handoffs accepted by iOS (earlier app versions): 0
        Rule changes saved in this app: 1
        Hiding switches turned off in this app: 1
        Only actions in the No Brainrot app are counted, not Safari use or protection. It cannot see Safari, the YouTube app or what you watch.
        """)
    }

    @Test func theSharedExportEndsWhenItIsShared() async throws {
        let clock = TestClock(Date(timeIntervalSince1970: 1_700_000_100))
        let rig = rig(now: { clock.now })
        let export = rig.model.countersExport
        clock.advance(by: 3 * 24 * 60 * 60)
        let lines = try await shared(export).split(separator: "\n")
        #expect(lines.dropFirst().first == "From 2023-11-14T22:15:00Z to 2023-11-17T22:15:00Z")
    }

    /// What an app picking the export from the share sheet receives.
    private func shared(_ export: CountersExport) async throws -> String {
        let provider = NSItemProvider()
        provider.register(export)
        return try await withCheckedThrowingContinuation { continuation in
            _ = provider.loadTransferable(type: String.self) { continuation.resume(with: $0) }
        }
    }
}
