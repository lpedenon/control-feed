import NoBrainrotKit
import SwiftUI

/// A list of words or names the person can add to and delete from.
struct EditableList: View {
    let title: String
    let hint: String
    let placeholder: String
    let entries: [String]
    let onChange: ([String]) -> Void
    @State private var draft = ""

    var body: some View {
        List {
            Section {
                if entries.isEmpty {
                    Text("Nothing here yet.").foregroundStyle(.secondary)
                }
                ForEach(entries, id: \.self) { entry in
                    Text(entry)
                }
                .onDelete { offsets in
                    var next = entries
                    next.remove(atOffsets: offsets)
                    onChange(next)
                }
            } header: {
                Text(hint).textCase(nil)
            }

            Section {
                HStack {
                    TextField(placeholder, text: $draft)
                        .plainTextEntry()
                        .submitLabel(.done)
                        .onSubmit(add)
                    Button("Add", action: add)
                        .buttonStyle(.borderless)
                        .disabled(cleanedDraft.isEmpty)
                }
            }
        }
        .navigationTitle(title)
        .inlineNavigationTitle()
    }

    private var cleanedDraft: String {
        TextNormalization.collapsingWhitespace(draft)
    }

    private func add() {
        let entry = cleanedDraft
        guard !entry.isEmpty else { return }
        onChange(entries + [entry])
        draft = ""
    }
}

/// One of the three lists of channels and words.
struct FilterListScreen: View {
    enum Kind: String, CaseIterable, Identifiable {
        case allowedChannels, blockedChannels, blockedKeywords

        var id: String { rawValue }

        var list: ExtensionSettings.FilterList {
            switch self {
            case .allowedChannels: .allowedChannels
            case .blockedChannels: .blockedChannels
            case .blockedKeywords: .blockedKeywords
            }
        }

        var title: String {
            switch self {
            case .allowedChannels: "Allowed channels"
            case .blockedChannels: "Blocked channels"
            case .blockedKeywords: "Blocked words in titles"
            }
        }

        var hint: String {
            switch self {
            case .allowedChannels:
                "One per row: the name shown on YouTube or an @handle. Their videos are never hidden by blocked words."
            case .blockedChannels:
                "Never shown anywhere on YouTube."
            case .blockedKeywords:
                "Hides videos whose title contains any of these words or phrases, in any capitalization."
            }
        }

        var placeholder: String {
            switch self {
            case .allowedChannels: "3Blue1Brown or @mitocw"
            case .blockedChannels: "Channel name or @handle"
            case .blockedKeywords: "prank"
            }
        }
    }

    @Environment(AppModel.self) private var model
    let kind: Kind

    var body: some View {
        EditableList(
            title: kind.title,
            hint: kind.hint,
            placeholder: kind.placeholder,
            entries: model.settings.entries(in: kind.list),
            onChange: { entries in model.change { $0.settingList(kind.list, to: entries) } }
        )
    }
}
