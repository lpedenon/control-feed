import Foundation
import Testing
@testable import NoBrainrotKit

/// Replays what `pnpm ios:contract` generated from the TypeScript extension.
/// If the two implementations disagree, these fail.
@Suite("Contract with the extension")
struct ContractTests {
    @Test func protocolVersionMatches() {
        #expect(TestContract.value("protocolVersion", in: TestContract.runtime)?.int64Value == Int64(SyncProtocol.version))
        #expect(TestContract.value("protocolVersion")?.int64Value == Int64(SyncProtocol.version))
        #expect(Catalog.shared.protocolVersion == SyncProtocol.version)
    }

    @Test func catalogListsEveryFeature() {
        let runtime = TestContract.runtime
        let keys = TestContract.array("features", in: runtime).compactMap { $0["key"]?.stringValue }
        #expect(Catalog.shared.features.map(\.key) == keys)
        #expect(keys.contains("ytShorts"))
        #expect(Catalog.shared.sites == strings(TestContract.value("sites", in: runtime)))
        #expect(Catalog.shared.siteHosts == strings(TestContract.value("siteHosts", in: runtime)))
        #expect(Catalog.shared.topicPresets.map(\.name).contains("AI"))
    }

    @Test func topicModesMatch() {
        #expect(TopicMode.allCases.map(\.rawValue) == strings(TestContract.value("topicModes", in: TestContract.runtime)))
    }

    @Test func contactReasonsAndAccessValuesMatch() {
        let runtime = TestContract.runtime
        #expect(ContactReason.allCases.map(\.rawValue) == strings(TestContract.value("contactReasons", in: runtime)))
        #expect(SiteAccess.allCases.map(\.rawValue) == strings(TestContract.value("siteAccessValues", in: runtime)))
        #expect(SiteAccess.notGranted.rawValue == "not-granted")
    }

    @Test func defaultsMatch() throws {
        let expected = try #require(TestContract.value("defaults", in: TestContract.runtime))
        #expect(try ExtensionSettings.defaults().toJSON() == expected)
    }

    @Test func parsingMatches() throws {
        let vectors = TestContract.array("vectors", "parseSettings")
        #expect(vectors.count >= 10)
        for vector in vectors {
            let name = vector["name"]?.stringValue ?? "?"
            let parsed = try ExtensionSettings.parse(vector["input"]).toJSON()
            #expect(parsed == vector["expected"], "parseSettings: \(name)")
        }
    }

    @Test func listNormalizationMatches() {
        let vectors = TestContract.array("vectors", "normalizeList")
        #expect(!vectors.isEmpty)
        for vector in vectors {
            #expect(
                TextNormalization.normalizedList(strings(vector["input"])) == strings(vector["expected"]),
                "normalizeList: \(strings(vector["input"]))"
            )
        }
    }

    @Test func topicNameComparisonMatches() {
        let vectors = TestContract.array("vectors", "sameTopicName")
        #expect(!vectors.isEmpty)
        for vector in vectors {
            let a = vector["a"]?.stringValue ?? ""
            let b = vector["b"]?.stringValue ?? ""
            #expect(Topics.same(a, b) == vector["expected"]?.boolValue, "sameTopicName: \(a) / \(b)")
        }
    }

    @Test func editsMatch() throws {
        let vectors = TestContract.array("vectors", "edits")
        #expect(vectors.count >= 4)
        for vector in vectors {
            let name = vector["name"]?.stringValue ?? "?"
            var settings = ExtensionSettings.defaults()
            for operation in vector["operations"]?.arrayValue ?? [] {
                settings = try apply(operation, to: settings)
            }
            #expect(try settings.toJSON() == vector["expected"], "edits: \(name)")
        }
    }

    @Test func requestExampleIsUnderstood() throws {
        let example = try #require(TestContract.value("syncRequestExample"))
        let request = try SyncRequest.parse(example).get()
        #expect(request.reason == .page)
        #expect(request.pageHost == "m.youtube.com")
        #expect(request.extensionVersion == "1.2.3")
        #expect(request.settingsUpdatedAt == 1_700_000_000_000)
        #expect(request.siteAccess == ["m.youtube.com": .granted, "www.youtube.com": .notGranted])
        #expect(try request.settings.toJSON() == example["settings"])
    }

    @Test func responseMatchesTheExample() throws {
        let example = try #require(TestContract.value("syncResponseExample"))
        let settings = ExtensionSettings.parse(example["settings"])
        let response = SyncResponse.accepted(appVersion: "1.0", settings: settings, settingsUpdatedAt: 1_700_000_000_001)
        #expect(try response.toJSON() == example)
    }

    @Test func refusalMatchesTheExample() throws {
        let example = try #require(TestContract.value("syncRefusalExample"))
        #expect(try SyncResponse.refused(.unsupportedProtocol).toJSON() == example)
    }

    private func apply(_ operation: JSONValue, to settings: ExtensionSettings) throws -> ExtensionSettings {
        let name = operation["name"]?.stringValue ?? ""
        switch operation["op"]?.stringValue {
        case "site":
            return settings.settingSite(operation["site"]?.stringValue ?? "", enabled: operation["enabled"]?.boolValue ?? false)
        case "feature":
            return settings.settingFeature(operation["key"]?.stringValue ?? "", enabled: operation["enabled"]?.boolValue ?? false)
        case "filters":
            return settings.withYoutubeFilters(patch: operation["patch"]?.objectValue ?? [:])
        case "topicAdd":
            return settings.addingTopic(named: name)
        case "topicRemove":
            return settings.removingTopic(named: name)
        case "topicKeywords":
            return settings.settingKeywords(forTopic: name, to: strings(operation["keywords"]))
        default:
            Issue.record("unknown operation \(String(describing: operation["op"]))")
            return settings
        }
    }
}
