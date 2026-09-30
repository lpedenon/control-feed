import Foundation
import Testing
@testable import NoBrainrotKit

@Suite("Settings")
struct SettingsTests {
    @Test func changesReturnNewValuesAndLeaveTheOriginal() {
        let original = ExtensionSettings.defaults()
        let changed = original.settingFeature("ytShorts", enabled: false)
        #expect(original.features["ytShorts"] == true)
        #expect(changed.features["ytShorts"] == false)
        #expect(original != changed)
    }

    @Test func unknownKeysAreIgnored() {
        let original = ExtensionSettings.defaults()
        #expect(original.settingFeature("nope", enabled: false) == original)
        #expect(original.settingSite("myspace", enabled: false) == original)
    }

    @Test func aFeatureIsOnlyActiveWhileItsSiteIsOn() {
        let settings = ExtensionSettings.defaults()
        #expect(settings.isEnabled("ytShorts"))
        #expect(!settings.isEnabled("ytComments"))
        #expect(!settings.settingSite("youtube", enabled: false).isEnabled("ytShorts"))
        #expect(!settings.isEnabled("unknown"))
    }

    @Test func listsAreCleanedOnEveryEdit() {
        let settings = ExtensionSettings.defaults().settingList(.blockedKeywords, to: ["  Prank ", "prank", "", "Reaction"])
        #expect(settings.entries(in: .blockedKeywords) == ["Prank", "Reaction"])
    }

    @Test func eachListIsIndependent() {
        let settings = ExtensionSettings.defaults()
            .settingList(.blockedChannels, to: ["@a"])
            .settingList(.allowedChannels, to: ["@b"])
        #expect(settings.entries(in: .blockedChannels) == ["@a"])
        #expect(settings.entries(in: .allowedChannels) == ["@b"])
        #expect(settings.entries(in: .blockedKeywords).isEmpty)
    }

    @Test func onlyAllowedChannelsAndTopicMode() {
        let settings = ExtensionSettings.defaults().settingOnlyAllowedChannels(true).settingTopicMode(.only)
        #expect(settings.youtubeFilters.onlyAllowedChannels)
        #expect(settings.youtubeFilters.topicMode == .only)
    }

    @Test func aPresetTopicStartsFromItsBuiltInWords() throws {
        let settings = ExtensionSettings.defaults().addingTopic(named: "ai")
        let topic = try #require(settings.youtubeFilters.topics.first)
        #expect(topic.name == "AI")
        #expect(topic.keywords.contains("machine learning"))
    }

    @Test func aCustomTopicStartsFromItsName() {
        let settings = ExtensionSettings.defaults().addingTopic(named: "  Woodworking  ")
        #expect(settings.youtubeFilters.topics == [Topic(name: "Woodworking", keywords: ["Woodworking"])])
    }

    @Test func aTopicAlreadyThereOrBlankIsLeftAlone() {
        let once = ExtensionSettings.defaults().addingTopic(named: "AI")
        #expect(once.addingTopic(named: "ai") == once)
        #expect(once.addingTopic(named: "   ") == once)
    }

    @Test func topicKeywordsAreEditableAndCleaned() throws {
        let settings = ExtensionSettings.defaults()
            .addingTopic(named: "Woodworking")
            .settingKeywords(forTopic: "woodworking", to: ["dovetail", "Dovetail", " jig "])
        #expect(settings.youtubeFilters.topics.first?.keywords == ["dovetail", "jig"])
    }

    @Test func topicsCanBeRemovedByLooseName() {
        let settings = ExtensionSettings.defaults().addingTopic(named: "AI").addingTopic(named: "Gaming").removingTopic(named: "ai")
        #expect(settings.youtubeFilters.topics.map(\.name) == ["Gaming"])
    }

    @Test func settingsSurviveAJSONRoundTrip() throws {
        let settings = ExtensionSettings.defaults()
            .settingFeature("ytComments", enabled: true)
            .addingTopic(named: "AI")
            .settingList(.allowedChannels, to: ["@mitocw"])
        #expect(ExtensionSettings.parse(try settings.toJSON()) == settings)
    }

    @Test func groupsFollowTheOrderOfTheCatalog() {
        let groups = Catalog.shared.featureGroups(forSite: "youtube")
        #expect(groups.map(\.name) == ["Browsing", "While watching"])
        #expect(groups.flatMap(\.features).map(\.key) == Catalog.shared.features(forSite: "youtube").map(\.key))
        #expect(Catalog.shared.featureGroups(forSite: "nothing").isEmpty)
    }

    @Test func theCompiledInContractLoads() throws {
        let catalog = try Catalog.load()
        #expect(catalog.features.count == Catalog.shared.features.count)
        #expect(!catalog.features.isEmpty)
    }
}

@Suite("JSON values")
struct JSONValueTests {
    @Test func booleansAndNumbersStayApart() throws {
        let value = try JSONValue(foundation: ["yes": true, "one": 1, "text": "1", "none": NSNull()] as [String: Any])
        #expect(value["yes"] == .bool(true))
        #expect(value["one"] == .number(1))
        #expect(value["text"] == .string("1"))
        #expect(value["none"] == .null)
    }

    @Test func nilIsNull() throws {
        #expect(try JSONValue(foundation: nil) == .null)
    }

    @Test func anObjectThatIsNotJSONIsRejected() {
        #expect(throws: (any Error).self) { _ = try JSONValue(foundation: ["date": Date()] as [String: Any]) }
    }

    @Test func wholeNumbersOnlyAreIntegers() {
        #expect(JSONValue.number(5).int64Value == 5)
        #expect(JSONValue.number(5.5).int64Value == nil)
        #expect(JSONValue.number(1e30).int64Value == nil)
        #expect(JSONValue.string("5").int64Value == nil)
    }

    @Test func roundTripsThroughFoundation() throws {
        let value = JSONValue.object(["a": .array([.number(1), .bool(false), .null, .string("é")])])
        #expect(try JSONValue(foundation: try value.foundationObject()) == value)
    }
}
