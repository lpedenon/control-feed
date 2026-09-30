import Foundation

/// Text handling that must give exactly the same answers as `src/core/text-match.ts`
/// and `normalizeList` in `src/core/settings.ts`. The contract vectors check it.
public enum TextNormalization {
    /// Case-, accent- and width-insensitive form used to compare names.
    public static func normalized(_ text: String) -> String {
        let decomposed = text.decomposedStringWithCompatibilityMapping
        let withoutMarks = String(String.UnicodeScalarView(decomposed.unicodeScalars.filter { scalar in
            switch scalar.properties.generalCategory {
            case .nonspacingMark, .spacingMark, .enclosingMark: return false
            default: return true
            }
        }))
        return collapsingWhitespace(withoutMarks.lowercased())
    }

    /// Runs of whitespace become one space and the ends are trimmed.
    public static func collapsingWhitespace(_ text: String) -> String {
        var result = String.UnicodeScalarView()
        var pendingSpace = false
        for scalar in text.unicodeScalars {
            if scalar.properties.isWhitespace {
                pendingSpace = !result.isEmpty
            } else {
                if pendingSpace { result.append(" ") }
                pendingSpace = false
                result.append(scalar)
            }
        }
        return String(result)
    }

    /// Trims entries, collapses inner whitespace, drops blanks and removes
    /// case-insensitive duplicates while keeping the first spelling.
    public static func normalizedList(_ entries: [String]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for entry in entries {
            let cleaned = collapsingWhitespace(entry)
            let key = cleaned.lowercased()
            if cleaned.isEmpty || seen.contains(key) { continue }
            seen.insert(key)
            result.append(cleaned)
        }
        return result
    }
}
