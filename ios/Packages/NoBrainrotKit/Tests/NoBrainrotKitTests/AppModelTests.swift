import Foundation
import Testing
@testable import NoBrainrotKit

@MainActor
private final class FakeOpener: URLOpening {
    var opened: [URL] = []
    var accepts = true
    func open(_ url: URL) async -> Bool {
        opened.append(url)
        return accepts
    }
}

@MainActor
@Suite("App model")
struct AppModelTests {
    private struct Rig {
        let model: AppModel
        let store: FakeStore
        let opener: FakeOpener
        let preferences: UserDefaults
    }

    private func rig(
        stored: StoredSettings? = nil,
        contact: ContactRecord? = nil,
        youtubeAppInstalled: Bool? = nil,
        storageAvailable: Bool = true
    ) -> Rig {
        let store = FakeStore(settings: stored, contact: contact)
        let opener = FakeOpener()
        let preferences = UserDefaults(suiteName: "no-brainrot-model-\(UUID().uuidString)")!
        let model = AppModel(dependencies: AppDependencies(
            repository: SettingsRepository(store: store, now: { Date(timeIntervalSince1970: 1_700_000_000) }),
            contacts: store,
            sharedStorageAvailable: storageAvailable,
            opener: opener,
            youtubeAppInstalled: { youtubeAppInstalled },
            preferences: preferences,
            now: { Date(timeIntervalSince1970: 1_700_000_100) }
        ))
        return Rig(model: model, store: store, opener: opener, preferences: preferences)
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

    @Test func opensCleanYouTubeInSafari() async {
        let rig = rig()
        await rig.model.openCleanYouTube()
        #expect(rig.opener.opened == [URL(string: "https://m.youtube.com/")!])
        #expect(rig.model.launchFailure == nil)
    }

    @Test func saysSoWhenTheHandoffFails() async {
        let rig = rig()
        rig.opener.accepts = false
        await rig.model.openCleanYouTube()
        #expect(rig.model.launchFailure?.contains("m.youtube.com") == true)
        rig.opener.accepts = true
        await rig.model.openCleanYouTube()
        #expect(rig.model.launchFailure == nil)
    }

    @Test func aFailureCanBeDismissedToo() async {
        let rig = rig()
        rig.opener.accepts = false
        await rig.model.openCleanYouTube()
        rig.model.dismissLaunchFailure()
        #expect(rig.model.launchFailure == nil)
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
}
