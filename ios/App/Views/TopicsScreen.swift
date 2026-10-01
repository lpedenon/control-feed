import NoBrainrotKit
import SwiftUI

struct TopicsScreen: View {
    @Environment(AppModel.self) private var model
    @State private var customName = ""
    private let catalog = Catalog.shared

    var body: some View {
        List {
            Section {
                Picker("Topic filter", selection: modeBinding) {
                    ForEach(TopicMode.allCases, id: \.self) { mode in
                        Text(Self.label(for: mode)).tag(mode)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } header: {
                Text("What to do with your topics")
            } footer: {
                Text(Self.explanation(for: model.settings.youtubeFilters.topicMode))
            }

            Section("Your topics") {
                if topics.isEmpty {
                    Text("No topics yet. Add one below.").foregroundStyle(.secondary)
                }
                ForEach(topics) { topic in
                    NavigationLink {
                        TopicWordsScreen(name: topic.name)
                    } label: {
                        HStack {
                            Text(topic.name)
                            Spacer()
                            Text("\(topic.keywords.count) words").foregroundStyle(.secondary)
                        }
                    }
                }
                .onDelete { offsets in
                    for index in offsets.sorted(by: >) {
                        let name = topics[index].name
                        model.change { $0.removingTopic(named: name) }
                    }
                }
            }

            Section {
                ForEach(availablePresets) { preset in
                    Button {
                        model.change { $0.addingTopic(named: preset.name) }
                    } label: {
                        Label(preset.name, systemImage: "plus.circle")
                    }
                }
                HStack {
                    TextField("Your own topic", text: $customName)
                        .submitLabel(.done)
                        .onSubmit(addCustom)
                    Button("Add", action: addCustom)
                        .buttonStyle(.borderless)
                        .disabled(TextNormalization.collapsingWhitespace(customName).isEmpty)
                }
            } header: {
                Text("Add a topic")
            } footer: {
                Text("A ready-made topic starts with its own list of words. You can change them.")
            }
        }
        .navigationTitle("Topics")
        .inlineNavigationTitle()
    }

    private var topics: [Topic] { model.settings.youtubeFilters.topics }

    private var availablePresets: [Topic] {
        catalog.topicPresets.filter { preset in
            !topics.contains { Topics.same($0.name, preset.name) }
        }
    }

    private var modeBinding: Binding<TopicMode> {
        Binding(
            get: { model.settings.youtubeFilters.topicMode },
            set: { mode in model.change { $0.settingTopicMode(mode) } }
        )
    }

    private func addCustom() {
        let name = customName
        guard !TextNormalization.collapsingWhitespace(name).isEmpty else { return }
        model.change { $0.addingTopic(named: name) }
        customName = ""
    }

    static func label(for mode: TopicMode) -> String {
        switch mode {
        case .off: "Off"
        case .only: "Only show videos about these topics"
        case .block: "Hide videos about these topics"
        }
    }

    static func explanation(for mode: TopicMode) -> String {
        switch mode {
        case .off: "Your topics are kept but not used."
        case .only: "Everything else is hidden: on the home page, in search, next to videos and on channel pages."
        case .block: "Videos whose title mentions one of these topics are hidden."
        }
    }
}

struct TopicWordsScreen: View {
    @Environment(AppModel.self) private var model
    let name: String

    var body: some View {
        EditableList(
            title: name,
            hint: "A video is about this topic when its title contains any of these words or phrases.",
            placeholder: "word or phrase",
            entries: model.settings.youtubeFilters.topics.first { Topics.same($0.name, name) }?.keywords ?? [],
            onChange: { words in model.change { $0.settingKeywords(forTopic: name, to: words) } }
        )
    }
}
