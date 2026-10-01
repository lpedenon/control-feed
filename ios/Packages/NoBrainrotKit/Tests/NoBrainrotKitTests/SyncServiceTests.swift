import Foundation
import Testing
@testable import NoBrainrotKit

@Suite("Sync with the extension")
struct SyncServiceTests {
    let clock = Date(timeIntervalSince1970: 1_700_000_100)

    private func service(_ store: FakeStore) -> SyncService {
        let time = clock
        return SyncService(settingsStore: store, contactStore: store, appVersion: "1.0", now: { time })
    }

    private var noShorts: ExtensionSettings { ExtensionSettings.defaults().settingFeature("ytShorts", enabled: false) }

    @Test func adoptsTheExtensionSettingsWhenTheAppHasNone() throws {
        let store = FakeStore()
        let response = service(store).respond(to: try requestJSON(settings: noShorts, settingsUpdatedAt: 50))
        #expect(response == .accepted(appVersion: "1.0", settings: noShorts, settingsUpdatedAt: 50))
        #expect(store.storedSettings == StoredSettings(settings: noShorts, updatedAt: 50))
    }

    @Test func adoptsNewerExtensionSettings() throws {
        let store = FakeStore(settings: StoredSettings(settings: .defaults(), updatedAt: 10))
        let response = service(store).respond(to: try requestJSON(settings: noShorts, settingsUpdatedAt: 20))
        #expect(response == .accepted(appVersion: "1.0", settings: noShorts, settingsUpdatedAt: 20))
        #expect(store.storedSettings?.updatedAt == 20)
    }

    @Test func answersWithNewerAppSettingsAndKeepsThem() throws {
        let store = FakeStore(settings: StoredSettings(settings: noShorts, updatedAt: 30))
        let response = service(store).respond(to: try requestJSON(settings: .defaults(), settingsUpdatedAt: 20))
        #expect(response == .accepted(appVersion: "1.0", settings: noShorts, settingsUpdatedAt: 30))
        #expect(store.storedSettings == StoredSettings(settings: noShorts, updatedAt: 30))
    }

    @Test func aTieKeepsTheApp() throws {
        let store = FakeStore(settings: StoredSettings(settings: noShorts, updatedAt: 30))
        let response = service(store).respond(to: try requestJSON(settings: .defaults(), settingsUpdatedAt: 30))
        #expect(response == .accepted(appVersion: "1.0", settings: noShorts, settingsUpdatedAt: 30))
    }

    @Test func repairsDamagedSettingsFromTheExtension() throws {
        let store = FakeStore()
        var request = try requestJSON(settingsUpdatedAt: 5)
        request = .object(request.objectValue!.merging([
            "settings": .object(["features": .object(["ytShorts": .string("maybe"), "ytComments": .bool(true)])]),
        ]) { _, new in new })
        guard case .accepted(_, let settings, _) = service(store).respond(to: request) else {
            Issue.record("expected an accepted answer")
            return
        }
        #expect(settings.features["ytShorts"] == true)
        #expect(settings.features["ytComments"] == true)
    }

    @Test func recordsAPageContact() throws {
        let store = FakeStore()
        _ = service(store).respond(to: try requestJSON(
            settingsUpdatedAt: 7,
            reason: "page",
            pageHost: "m.youtube.com",
            siteAccess: ["m.youtube.com": "granted", "www.youtube.com": "not-granted"]
        ))
        let record = try #require(store.loadContact())
        #expect(record.lastContactAt == clock)
        #expect(record.lastPageAt == clock)
        #expect(record.lastPageHost == "m.youtube.com")
        #expect(record.extensionVersion == "0.2.0")
        #expect(record.siteAccess == ["m.youtube.com": .granted, "www.youtube.com": .notGranted])
        #expect(record.extensionSettingsUpdatedAt == 7)
        #expect(record.deliveredSettingsUpdatedAt == 7)
    }

    @Test func aStartUpDoesNotCountAsSeeingAPage() throws {
        let earlier = Date(timeIntervalSince1970: 1_600_000_000)
        let store = FakeStore(contact: ContactRecord(
            lastContactAt: earlier, extensionVersion: "0.1", siteAccess: [:],
            lastPageAt: earlier, lastPageHost: "www.youtube.com",
            extensionSettingsUpdatedAt: 0, deliveredSettingsUpdatedAt: 0
        ))
        _ = service(store).respond(to: try requestJSON(reason: "startup", pageHost: nil))
        let record = try #require(store.loadContact())
        #expect(record.lastContactAt == clock)
        #expect(record.lastPageAt == earlier)
        #expect(record.lastPageHost == "www.youtube.com")
    }

    @Test func aStartUpFirstRecordsNoPage() throws {
        let store = FakeStore()
        _ = service(store).respond(to: try requestJSON(reason: "startup", pageHost: nil))
        #expect(store.loadContact()?.lastPageAt == nil)
    }

    @Test func ignoresAPageHostThatIsNotSupported() throws {
        let store = FakeStore()
        _ = service(store).respond(to: try requestJSON(pageHost: "evil.example"))
        #expect(store.loadContact()?.lastPageHost == nil)
    }

    @Test func unknownSiteAccessWhenNotReported() throws {
        let store = FakeStore()
        _ = service(store).respond(to: try requestJSON(siteAccess: ["m.youtube.com": "bogus"]))
        #expect(store.loadContact()?.siteAccess == ["m.youtube.com": .unknown, "www.youtube.com": .unknown])
    }

    @Test func refusesAnotherProtocolVersionAndRecordsNothing() throws {
        let store = FakeStore()
        let response = service(store).respond(to: try requestJSON(protocolVersion: SyncProtocol.version + 1))
        #expect(response == .refused(.unsupportedProtocol))
        #expect(store.loadContact() == nil)
        #expect(store.storedSettings == nil)
    }

    @Test(arguments: [
        JSONValue.null,
        .string("sync"),
        .array([]),
        .object([:]),
        .object(["type": .string("other"), "protocolVersion": .number(1)]),
        .object(["type": .string("sync")]),
        .object(["type": .string("sync"), "protocolVersion": .string("1")]),
        .object(["type": .string("sync"), "protocolVersion": .number(1.5)]),
        .object(["type": .string("sync"), "protocolVersion": .number(1), "reason": .string("nap")]),
    ])
    func refusesMalformedRequests(raw: JSONValue) {
        let store = FakeStore()
        #expect(service(store).respond(to: raw) == .refused(.invalidRequest))
        #expect(store.loadContact() == nil)
    }

    @Test func refusesWhenSettingsCannotBeStored() throws {
        let store = FakeStore()
        store.failSaving = true
        #expect(service(store).respond(to: try requestJSON(settingsUpdatedAt: 5)) == .refused(.storageFailed))
        #expect(store.loadContact() == nil)
    }

    @Test func anUnreadableStoreIsTreatedAsEmpty() throws {
        let store = FakeStore(settings: StoredSettings(settings: noShorts, updatedAt: 99))
        store.failLoading = true
        let response = service(store).respond(to: try requestJSON(settingsUpdatedAt: 5))
        #expect(response == .accepted(appVersion: "1.0", settings: .defaults(), settingsUpdatedAt: 5))
    }

    @Test func handleAnswersInJSONWithoutThrowing() throws {
        let store = FakeStore()
        let answer = service(store).handle(try requestJSON(settings: noShorts, settingsUpdatedAt: 5))
        #expect(answer["ok"]?.boolValue == true)
        #expect(answer["settingsUpdatedAt"]?.int64Value == 5)
        #expect(service(store).handle(nil) == .object(["ok": .bool(false), "error": .string("invalid-request")]))
    }

    @Test func aMessageFromSafariRoundTripsThroughFoundationTypes() throws {
        // What Safari hands over is Foundation objects, and what goes back must be too.
        let foundation = try requestJSON(settings: noShorts, settingsUpdatedAt: 8).foundationObject()
        let raw = try JSONValue(foundation: foundation)
        let answer = service(FakeStore()).handle(raw)
        let back = try JSONValue(foundation: try answer.foundationObject())
        #expect(back == answer)
        #expect(back["ok"]?.boolValue == true)
    }

    @Test func theRecordHoldsNothingAboutWhatIsWatched() throws {
        let store = FakeStore()
        _ = service(store).respond(to: try requestJSON())
        let record = try #require(store.loadContact())
        let data = try JSONEncoder().encode(record)
        let keys = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any]).keys.sorted()
        #expect(keys == [
            "deliveredSettingsUpdatedAt", "extensionSettingsUpdatedAt", "extensionVersion",
            "lastContactAt", "lastPageAt", "lastPageHost", "siteAccess",
        ])
    }
}
