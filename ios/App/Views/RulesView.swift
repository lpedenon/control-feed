import NoBrainrotKit
import SwiftUI

/// The rules the extension follows on YouTube. The app supports YouTube only,
/// so the other sites in the shared catalog are not offered here.
struct RulesView: View {
    @Environment(AppModel.self) private var model
    private let catalog = Catalog.shared
    private let site = "youtube"

    var body: some View {
        List {
            if let failure = model.saveFailure {
                Section { Banner(text: failure, dismiss: model.dismissSaveFailure) }
            }

            Section {
                Toggle(isOn: siteBinding) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Use No Brainrot on YouTube")
                        Text("Turns everything below on or off at once.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            ForEach(catalog.featureGroups(forSite: site), id: \.name) { group in
                Section(group.name) {
                    ForEach(group.features) { feature in
                        Toggle(isOn: featureBinding(feature)) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(feature.label)
                                if let description = feature.description {
                                    Text(description)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
                .disabled(!siteEnabled)
            }

            Section {
                Toggle(isOn: onlyAllowedBinding) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Only show allowed channels")
                        Text("Videos from any other channel are hidden.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                ForEach(FilterListScreen.Kind.allCases) { kind in
                    NavigationLink {
                        FilterListScreen(kind: kind)
                    } label: {
                        HStack {
                            Text(kind.title)
                            Spacer()
                            Text("\(model.settings.entries(in: kind.list).count)")
                                .foregroundStyle(.secondary)
                                .accessibilityLabel("\(model.settings.entries(in: kind.list).count) entries")
                        }
                    }
                }
                NavigationLink {
                    TopicsScreen()
                } label: {
                    HStack {
                        Text("Topics")
                        Spacer()
                        Text(topicSummary).foregroundStyle(.secondary)
                    }
                }
            } header: {
                Text("Channels, words and topics")
            } footer: {
                Text("These apply to video lists on m.youtube.com: the home page, search, next to a video and on channel pages.")
            }
            .disabled(!siteEnabled)
        }
        .navigationTitle("Rules")
    }

    private var siteEnabled: Bool { model.settings.sites[site] ?? true }

    private var siteBinding: Binding<Bool> {
        Binding(
            get: { siteEnabled },
            set: { enabled in model.change { $0.settingSite(site, enabled: enabled) } }
        )
    }

    private func featureBinding(_ feature: FeatureDefinition) -> Binding<Bool> {
        Binding(
            get: { model.settings.features[feature.key] ?? feature.defaultEnabled },
            set: { enabled in model.change { $0.settingFeature(feature.key, enabled: enabled) } }
        )
    }

    private var onlyAllowedBinding: Binding<Bool> {
        Binding(
            get: { model.settings.youtubeFilters.onlyAllowedChannels },
            set: { enabled in model.change { $0.settingOnlyAllowedChannels(enabled) } }
        )
    }

    private var topicSummary: String {
        let filters = model.settings.youtubeFilters
        switch filters.topicMode {
        case .off: return filters.topics.isEmpty ? "None" : "Off"
        case .only: return "Only these"
        case .block: return "Hide these"
        }
    }
}
