import Foundation
import Testing
@testable import NoBrainrotKit

@Suite("Shared storage")
struct StoresTests {
    private func makeStore() -> (SharedDefaultsStore, UserDefaults, String) {
        let suite = "no-brainrot-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        return (SharedDefaultsStore(defaults: defaults), defaults, suite)
    }

    @Test func nothingStoredYet() throws {
        let (store, _, _) = makeStore()
        #expect(try store.loadSettings() == nil)
        #expect(store.loadContact() == nil)
    }

    @Test func settingsRoundTrip() throws {
        let (store, _, _) = makeStore()
        let stored = StoredSettings(
            settings: ExtensionSettings.defaults().settingFeature("ytComments", enabled: true).addingTopic(named: "AI"),
            updatedAt: 1_700_000_000_123
        )
        try store.saveSettings(stored)
        #expect(try store.loadSettings() == stored)
    }

    @Test func aSecondStoreOnTheSameDefaultsSeesTheChange() throws {
        // The app and its extension are two processes with two store objects over one suite.
        let (writer, defaults, _) = makeStore()
        let reader = SharedDefaultsStore(defaults: defaults)
        try writer.saveSettings(StoredSettings(settings: .defaults(), updatedAt: 5))
        #expect(try reader.loadSettings()?.updatedAt == 5)
    }

    @Test func contactRoundTrip() {
        let (store, _, _) = makeStore()
        let record = ContactRecord(
            lastContactAt: Date(timeIntervalSince1970: 1_700_000_000.5),
            extensionVersion: "0.2.0",
            siteAccess: ["m.youtube.com": .granted, "www.youtube.com": .unknown],
            lastPageAt: Date(timeIntervalSince1970: 1_699_999_000),
            lastPageHost: "m.youtube.com",
            extensionSettingsUpdatedAt: 1,
            deliveredSettingsUpdatedAt: 2
        )
        store.saveContact(record)
        #expect(store.loadContact() == record)
    }

    @Test func damagedSettingsAreRepairedNotTrusted() throws {
        let (store, defaults, _) = makeStore()
        let damaged = #"{"settings":{"features":{"ytShorts":"maybe"},"sites":7},"updatedAt":9}"#
        defaults.set(Data(damaged.utf8), forKey: SharedDefaultsStore.settingsKey)
        let loaded = try #require(try store.loadSettings())
        #expect(loaded.updatedAt == 9)
        #expect(loaded.settings == .defaults())
    }

    @Test func settingsWithoutAStampAreTreatedAsAbsent() throws {
        let (store, defaults, _) = makeStore()
        defaults.set(Data(#"{"settings":{}}"#.utf8), forKey: SharedDefaultsStore.settingsKey)
        #expect(try store.loadSettings() == nil)
    }

    @Test func aNegativeStampBecomesZero() throws {
        let (store, defaults, _) = makeStore()
        defaults.set(Data(#"{"settings":{},"updatedAt":-4}"#.utf8), forKey: SharedDefaultsStore.settingsKey)
        #expect(try store.loadSettings()?.updatedAt == 0)
    }

    @Test func unreadableSettingsThrowRatherThanPretendToBeEmpty() {
        let (store, defaults, _) = makeStore()
        defaults.set(Data("not json".utf8), forKey: SharedDefaultsStore.settingsKey)
        #expect(throws: (any Error).self) { try store.loadSettings() }
    }

    @Test func unreadableContactIsIgnored() {
        let (store, defaults, _) = makeStore()
        defaults.set(Data("nope".utf8), forKey: SharedDefaultsStore.contactKey)
        #expect(store.loadContact() == nil)
    }

    @Test func noGroupNoStore() {
        #expect(SharedDefaultsStore.appGroup("") == nil)
    }
}

@Suite("Settings repository")
struct SettingsRepositoryTests {
    @Test func startsFromDefaultsNeverChanged() {
        let repository = SettingsRepository(store: FakeStore())
        #expect(repository.current() == StoredSettings(settings: .defaults(), updatedAt: 0))
    }

    @Test func aSaveIsStampedWithTheTime() throws {
        let time = Date(timeIntervalSince1970: 1_700_000_000)
        let repository = SettingsRepository(store: FakeStore(), now: { time })
        let saved = try repository.save(ExtensionSettings.defaults().settingFeature("ytShorts", enabled: false))
        #expect(saved.updatedAt == 1_700_000_000_000)
        #expect(repository.current() == saved)
    }

    @Test func aChangeAlwaysBeatsThePreviousStampEvenIfTheClockWentBack() throws {
        let store = FakeStore(settings: StoredSettings(settings: .defaults(), updatedAt: 5_000_000_000_000))
        let repository = SettingsRepository(store: store, now: { Date(timeIntervalSince1970: 1) })
        #expect(try repository.save(.defaults()).updatedAt == 5_000_000_000_001)
    }

    @Test func aFailedSaveIsReported() {
        let store = FakeStore()
        store.failSaving = true
        #expect(throws: (any Error).self) { try SettingsRepository(store: store).save(.defaults()) }
    }

    @Test func anUnreadableStoreFallsBackToDefaults() {
        let store = FakeStore(settings: StoredSettings(settings: .defaults().settingFeature("ytShorts", enabled: false), updatedAt: 3))
        store.failLoading = true
        #expect(SettingsRepository(store: store).current() == StoredSettings(settings: .defaults(), updatedAt: 0))
    }
}
