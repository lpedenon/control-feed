import Foundation

public struct YoutubeFilters: Codable, Equatable, Sendable {
    public var blockedKeywords: [String]
    public var blockedChannels: [String]
    public var allowedChannels: [String]
    public var onlyAllowedChannels: Bool
    public var topicMode: TopicMode
    public var topics: [Topic]

    public static let empty = YoutubeFilters(
        blockedKeywords: [], blockedChannels: [], allowedChannels: [],
        onlyAllowedChannels: false, topicMode: .off, topics: []
    )

    /// Field by field, like `parseSettings` in the extension: one bad value
    /// falls back to its default and never spoils the rest.
    static func parse(_ raw: JSONValue?) -> YoutubeFilters {
        guard case .object(let object)? = raw else { return .empty }
        return YoutubeFilters(
            blockedKeywords: list(object["blockedKeywords"]),
            blockedChannels: list(object["blockedChannels"]),
            allowedChannels: list(object["allowedChannels"]),
            onlyAllowedChannels: object["onlyAllowedChannels"]?.boolValue ?? false,
            topicMode: object["topicMode"]?.stringValue.flatMap(TopicMode.init(rawValue:)) ?? .off,
            topics: topics(object["topics"])
        )
    }

    private static func list(_ raw: JSONValue?) -> [String] {
        guard let items = raw?.arrayValue else { return [] }
        return TextNormalization.normalizedList(items.compactMap(\.stringValue))
    }

    private static func topics(_ raw: JSONValue?) -> [Topic] {
        guard let items = raw?.arrayValue else { return [] }
        var topics: [Topic] = []
        for item in items {
            guard case .object(let object) = item,
                  let name = object["name"]?.stringValue.map(TextNormalization.collapsingWhitespace),
                  !name.isEmpty,
                  !topics.contains(where: { Topics.same($0.name, name) })
            else { continue }
            topics.append(Topic(name: name, keywords: list(object["keywords"])))
        }
        return topics
    }
}

/// The user's choices, in the same shape the extension stores them. Every
/// change returns a new value.
public struct ExtensionSettings: Codable, Equatable, Sendable {
    public let sites: [String: Bool]
    public let features: [String: Bool]
    public let youtubeFilters: YoutubeFilters

    public init(sites: [String: Bool], features: [String: Bool], youtubeFilters: YoutubeFilters) {
        self.sites = sites
        self.features = features
        self.youtubeFilters = youtubeFilters
    }

    /// Turns anything into valid settings, repairing what is wrong.
    public static func parse(_ raw: JSONValue?, catalog: Catalog = .shared) -> ExtensionSettings {
        let object = raw?.objectValue ?? [:]
        let sites = object["sites"]?.objectValue ?? [:]
        let features = object["features"]?.objectValue ?? [:]
        return ExtensionSettings(
            sites: Dictionary(uniqueKeysWithValues: catalog.sites.map { ($0, sites[$0]?.boolValue ?? true) }),
            features: Dictionary(uniqueKeysWithValues: catalog.features.map {
                ($0.key, features[$0.key]?.boolValue ?? $0.defaultEnabled)
            }),
            youtubeFilters: YoutubeFilters.parse(object["youtubeFilters"])
        )
    }

    public static func defaults(catalog: Catalog = .shared) -> ExtensionSettings {
        parse(nil, catalog: catalog)
    }

    public func toJSON() throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(self))
    }

    public func isEnabled(_ featureKey: String, catalog: Catalog = .shared) -> Bool {
        guard let feature = catalog.features.first(where: { $0.key == featureKey }) else { return false }
        return (sites[feature.site] ?? true) && (features[featureKey] ?? feature.defaultEnabled)
    }

    // MARK: Changes

    public func settingSite(_ site: String, enabled: Bool) -> ExtensionSettings {
        guard sites[site] != nil else { return self }
        return ExtensionSettings(sites: sites.merging([site: enabled]) { _, new in new }, features: features, youtubeFilters: youtubeFilters)
    }

    public func settingFeature(_ key: String, enabled: Bool) -> ExtensionSettings {
        guard features[key] != nil else { return self }
        return ExtensionSettings(sites: sites, features: features.merging([key: enabled]) { _, new in new }, youtubeFilters: youtubeFilters)
    }

    /// Applies a patch of filter fields and re-validates the result, like
    /// `withYoutubeFilters` in the extension. An invalid patched value is repaired.
    public func withYoutubeFilters(patch: [String: JSONValue]) -> ExtensionSettings {
        guard let encoded = try? JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(youtubeFilters)),
              case .object(let current) = encoded
        else { return self }
        let merged = current.merging(patch) { _, new in new }
        return ExtensionSettings(sites: sites, features: features, youtubeFilters: YoutubeFilters.parse(.object(merged)))
    }

    public func settingTopicMode(_ mode: TopicMode) -> ExtensionSettings {
        withYoutubeFilters(patch: ["topicMode": .string(mode.rawValue)])
    }

    public func settingOnlyAllowedChannels(_ enabled: Bool) -> ExtensionSettings {
        withYoutubeFilters(patch: ["onlyAllowedChannels": .bool(enabled)])
    }

    public enum FilterList: String, Sendable, CaseIterable {
        case blockedKeywords, blockedChannels, allowedChannels
    }

    public func settingList(_ list: FilterList, to entries: [String]) -> ExtensionSettings {
        withYoutubeFilters(patch: [list.rawValue: .array(entries.map(JSONValue.string))])
    }

    public func entries(in list: FilterList) -> [String] {
        switch list {
        case .blockedKeywords: youtubeFilters.blockedKeywords
        case .blockedChannels: youtubeFilters.blockedChannels
        case .allowedChannels: youtubeFilters.allowedChannels
        }
    }

    /// Adds a topic, starting from the built-in words when there is a preset
    /// with that name. A name already on the list is left alone.
    public func addingTopic(named name: String, catalog: Catalog = .shared) -> ExtensionSettings {
        let cleaned = TextNormalization.collapsingWhitespace(name)
        if cleaned.isEmpty || youtubeFilters.topics.contains(where: { Topics.same($0.name, cleaned) }) {
            return self
        }
        let topic = catalog.preset(named: cleaned) ?? Topic(name: cleaned, keywords: [cleaned])
        return settingTopics(youtubeFilters.topics + [topic])
    }

    public func removingTopic(named name: String) -> ExtensionSettings {
        settingTopics(youtubeFilters.topics.filter { !Topics.same($0.name, name) })
    }

    public func settingKeywords(forTopic name: String, to keywords: [String]) -> ExtensionSettings {
        settingTopics(youtubeFilters.topics.map {
            Topics.same($0.name, name) ? Topic(name: $0.name, keywords: keywords) : $0
        })
    }

    private func settingTopics(_ topics: [Topic]) -> ExtensionSettings {
        let encoded = topics.map { JSONValue.object(["name": .string($0.name), "keywords": .array($0.keywords.map(JSONValue.string))]) }
        return withYoutubeFilters(patch: ["topics": .array(encoded)])
    }
}
