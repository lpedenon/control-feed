import Foundation

public struct FeatureDefinition: Decodable, Equatable, Sendable, Identifiable {
    public let key: String
    public let site: String
    public let group: String
    public let label: String
    public let description: String?
    public let defaultEnabled: Bool

    public var id: String { key }
}

public struct Topic: Codable, Equatable, Sendable, Identifiable {
    public let name: String
    public let keywords: [String]

    public var id: String { name }

    public init(name: String, keywords: [String]) {
        self.name = name
        self.keywords = keywords
    }
}

public enum TopicMode: String, Codable, CaseIterable, Sendable {
    case off
    case only
    case block
}

public enum CatalogError: Error, Equatable {
    case unreadable(String)
}

/// What the extension offers, read from `ContractData`, which is generated from
/// `src/core/features.ts` and `src/core/topics.ts`. The app renders its controls
/// from this list, so a new switch in the extension appears here after
/// `pnpm ios:contract` without a Swift change.
public struct Catalog: Decodable, Sendable {
    public let protocolVersion: Int
    public let siteHosts: [String]
    public let sites: [String]
    public let features: [FeatureDefinition]
    public let topicPresets: [Topic]

    /// Reads the catalog compiled into the package from `ContractData`.
    public static func load() throws -> Catalog {
        do {
            return try JSONDecoder().decode(Catalog.self, from: Data(ContractData.json.utf8))
        } catch {
            throw CatalogError.unreadable(String(describing: error))
        }
    }

    /// The catalog every part of the app shares.
    public static let shared: Catalog = {
        do {
            return try Catalog.load()
        } catch {
            preconditionFailure("No Brainrot could not read its compiled-in contract: \(error)")
        }
    }()

    public func features(forSite site: String) -> [FeatureDefinition] {
        features.filter { $0.site == site }
    }

    /// Groups in the order they first appear, each with its features.
    public func featureGroups(forSite site: String) -> [(name: String, features: [FeatureDefinition])] {
        var order: [String] = []
        var byGroup: [String: [FeatureDefinition]] = [:]
        for feature in features(forSite: site) {
            if byGroup[feature.group] == nil { order.append(feature.group) }
            byGroup[feature.group, default: []].append(feature)
        }
        return order.map { (name: $0, features: byGroup[$0] ?? []) }
    }

    public func preset(named name: String) -> Topic? {
        topicPresets.first { Topics.same($0.name, name) }
    }
}

public enum Topics {
    public static func same(_ a: String, _ b: String) -> Bool {
        TextNormalization.normalized(a) == TextNormalization.normalized(b)
    }
}
