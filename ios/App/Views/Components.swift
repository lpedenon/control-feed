import SwiftUI

/// A numbered instruction. The number and title are read as one item, and any
/// buttons the step needs stay separate so they remain reachable.
struct StepHeader: View {
    let number: Int
    let title: String
    @ScaledMetric(relativeTo: .body) private var badge: CGFloat = 28

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("\(number)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: badge, height: badge)
                .background(Circle().fill(Color.accentColor))
                .accessibilityHidden(true)
            Text(title).font(.headline)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number). \(title)")
        .accessibilityAddTraits(.isHeader)
    }
}

struct Step<Content: View>: View {
    let number: Int
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            StepHeader(number: number, title: title)
            content
        }
        .padding(.vertical, 4)
    }
}

/// A short paragraph in the secondary style used for explanations.
struct Explainer: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct DetailRow: View {
    let title: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.footnote).foregroundStyle(.secondary)
            Text(text).fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }
}

struct Banner: View {
    let text: String
    var systemImage = "exclamationmark.triangle.fill"
    var dismiss: (() -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: systemImage)
                .foregroundStyle(.orange)
                .accessibilityHidden(true)
            Text(text).fixedSize(horizontal: false, vertical: true)
            if let dismiss {
                Spacer(minLength: 0)
                Button("Dismiss", action: dismiss)
                    .buttonStyle(.borderless)
            }
        }
        .font(.subheadline)
        .accessibilityElement(children: dismiss == nil ? .combine : .contain)
    }
}
