import Foundation

public enum JSONValueError: Error, Equatable {
    case notJSON
}

/// Any JSON document. Messages from the extension and stored settings pass
/// through this before they are trusted, so nothing is force-cast from `Any`.
public enum JSONValue: Equatable, Sendable, Codable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }

    /// Reads a value produced by `JSONSerialization` or handed over by Safari.
    /// Booleans stay booleans and numbers stay numbers, because the round trip
    /// goes through JSON text rather than Objective-C bridging. Anything that
    /// is not plain JSON is rejected (`JSONSerialization` would otherwise raise
    /// an Objective-C exception, which Swift cannot catch).
    public init(foundation object: Any?) throws {
        guard let object, !(object is NSNull) else {
            self = .null
            return
        }
        // Wrapped in an array because only containers can be checked and serialized without fragments.
        let wrapped = [object]
        guard JSONSerialization.isValidJSONObject(wrapped) else { throw JSONValueError.notJSON }
        let data = try JSONSerialization.data(withJSONObject: wrapped)
        guard let value = try JSONDecoder().decode([JSONValue].self, from: data).first else {
            throw JSONValueError.notJSON
        }
        self = value
    }

    /// The same value as Foundation types, for handing back to Safari.
    public func foundationObject() throws -> Any {
        let data = try JSONEncoder().encode([self])
        guard let wrapped = try JSONSerialization.jsonObject(with: data) as? [Any], let value = wrapped.first else {
            throw JSONValueError.notJSON
        }
        return value
    }

    public var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    public var boolValue: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }

    public var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    public var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    /// A whole number, or nil for anything else (including fractions and huge values).
    public var int64Value: Int64? {
        if case .number(let value) = self { return Int64(exactly: value) }
        return nil
    }

    public subscript(key: String) -> JSONValue? {
        objectValue?[key]
    }
}
