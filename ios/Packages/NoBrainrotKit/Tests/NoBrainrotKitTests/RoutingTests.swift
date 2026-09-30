import Foundation
import Testing
@testable import NoBrainrotKit

@Suite("Routing and handler entry point")
struct RoutingTests {
    @Test(arguments: AppRoute.allCases)
    func everyScreenHasALink(route: AppRoute) {
        #expect(AppRoute(url: URL(string: "nobrainrot://\(route.rawValue)")!) == route)
    }

    @Test func linksAreCaseInsensitiveAndIgnorePaths() {
        #expect(AppRoute(url: URL(string: "NoBrainrot://Rules/extra?x=1")!) == .rules)
    }

    @Test(arguments: ["https://rules", "nobrainrot://", "nobrainrot://unknown", "other://rules", "nobrainrot:rules"])
    func otherLinksAreIgnored(text: String) {
        #expect(AppRoute(url: URL(string: text)!) == nil)
    }

    @Test func theHandlerAnswersFoundationMessages() throws {
        let store = FakeStore()
        let service = SyncService(settingsStore: store, contactStore: store, appVersion: "1.0")
        let message = try requestJSON(settingsUpdatedAt: 3).foundationObject()
        let answer = try #require(service.handle(foundation: message) as? [String: Any])
        #expect(answer["ok"] as? Bool == true)
        #expect(answer["settingsUpdatedAt"] as? Int == 3)
        #expect(store.loadContact() != nil)
    }

    @Test(arguments: [nil, "hello" as Any?, 42 as Any?, Date() as Any?, ["a": Date()] as Any?])
    func theHandlerRefusesWhatIsNotAMessage(message: Any?) throws {
        let store = FakeStore()
        let service = SyncService(settingsStore: store, contactStore: store, appVersion: "1.0")
        let answer = try #require(service.handle(foundation: message) as? [String: Any])
        #expect(answer["ok"] as? Bool == false)
        #expect(answer["error"] as? String == "invalid-request")
        #expect(store.loadContact() == nil)
    }
}

@Suite("Extension entry point")
struct ExtensionEntryPointTests {
    private func defaults() -> UserDefaults {
        UserDefaults(suiteName: "no-brainrot-entry-\(UUID().uuidString)")!
    }

    @Test func answersAndRecordsThroughSharedStorage() throws {
        let shared = defaults()
        let message = try requestJSON(settingsUpdatedAt: 4).foundationObject()
        let answer = try #require(
            ExtensionEntryPoint.answer(to: message, appGroup: "group.unused", appVersion: "2.0", defaults: shared) as? [String: Any]
        )
        #expect(answer["ok"] as? Bool == true)
        #expect(answer["appVersion"] as? String == "2.0")
        // The app reads what the extension stored, through the same defaults.
        let store = SharedDefaultsStore(defaults: shared)
        #expect(try store.loadSettings()?.updatedAt == 4)
        #expect(store.loadContact()?.extensionVersion == "0.2.0")
    }

    @Test func saysSoWhenTheAppGroupCannotBeReached() throws {
        let answer = try #require(
            ExtensionEntryPoint.answer(to: try requestJSON().foundationObject(), appGroup: "", appVersion: "2.0") as? [String: Any]
        )
        #expect(answer["ok"] as? Bool == false)
        #expect(answer["error"] as? String == "storage-failed")
    }
}
