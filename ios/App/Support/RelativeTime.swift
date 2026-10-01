import Foundation

enum RelativeTime {
    private static let formatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter
    }()

    /// "3 hours ago", "yesterday", "in 5 minutes" if the clock is off.
    static func describe(_ date: Date) -> String {
        formatter.localizedString(for: date, relativeTo: Date())
    }
}
