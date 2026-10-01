import Foundation
@testable import NoBrainrotKit

/// The generated vectors and examples, read as raw JSON so tests can replay them.
enum TestContract {
    static let vectors: JSONValue = load(resource: "contract-vectors")

    /// What the app has compiled in.
    static let runtime: JSONValue = {
        do { return try JSONDecoder().decode(JSONValue.self, from: Data(ContractData.json.utf8)) } catch {
            fatalError("ContractData is not readable: \(error)")
        }
    }()

    private static func load(resource: String) -> JSONValue {
        guard let url = Bundle.module.url(forResource: resource, withExtension: "json") else {
            fatalError("\(resource).json is not bundled with the tests")
        }
        do { return try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)) } catch {
            fatalError("\(resource).json is not readable: \(error)")
        }
    }

    static func array(_ path: String..., in document: JSONValue? = nil) -> [JSONValue] {
        var value: JSONValue? = document ?? vectors
        for key in path { value = value?[key] }
        return value?.arrayValue ?? []
    }

    static func value(_ path: String..., in document: JSONValue? = nil) -> JSONValue? {
        var value: JSONValue? = document ?? vectors
        for key in path { value = value?[key] }
        return value
    }
}

func strings(_ value: JSONValue?) -> [String] {
    (value?.arrayValue ?? []).compactMap(\.stringValue)
}
