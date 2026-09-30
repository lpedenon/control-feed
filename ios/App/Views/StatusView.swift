import NoBrainrotKit
import SwiftUI

struct StatusView: View {
    @Environment(AppModel.self) private var model
    @Binding var showSetup: Bool

    var body: some View {
        let copy = model.statusCopy(relative: RelativeTime.describe)
        List {
            if !model.sharedStorageAvailable {
                Section {
                    Banner(text: "This copy of the app cannot share your rules with Safari, so changes here will not reach the extension. Reinstall the app from a build that includes the App Group.")
                }
            }

            Section {
                StatusHeader(level: model.status.level, copy: copy)
            }

            Section {
                Button {
                    Task { await model.openCleanYouTube() }
                } label: {
                    Label("Open YouTube in Safari", systemImage: "safari")
                }
                if model.status.level != .working {
                    Button {
                        showSetup = true
                    } label: {
                        Label("Set up the extension", systemImage: "list.number")
                    }
                }
                if let failure = model.launchFailure {
                    Banner(text: failure, dismiss: model.dismissLaunchFailure)
                }
            } footer: {
                Text("Opens m.youtube.com in Safari, where the extension works.")
            }

            Section("Details") {
                DetailRow(title: "Rules", text: copy.deliveryLine ?? "You have not changed the rules, so the standard ones apply.")
                DetailRow(title: "Gate", text: gateText)
                DetailRow(title: "YouTube app", text: youtubeAppText)
            }

            Section {
                ForEach(model.counters.rows) { row in
                    LabeledContent(row.label, value: row.count, format: .number)
                }
                ShareLink(item: model.countersExport()) {
                    Label("Export counters", systemImage: "square.and.arrow.up")
                }
            } header: {
                Text("Counted in this app")
            } footer: {
                Text("Since \(model.counters.since.formatted(date: .abbreviated, time: .omitted)). \(LocalCounters.scopeNote) The counts stay on this iPhone unless you export them.")
            }

            Section {
                Text(copy.footnote)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .navigationTitle("No Brainrot")
        .refreshable { model.refresh() }
    }

    private var gateText: String {
        model.status.gateMarkedSetUp
            ? "You marked the Shortcut as set up. iOS does not let apps check, so this is your note, not something the app confirmed."
            : "Not set up. The gate is optional."
    }

    private var youtubeAppText: String {
        switch model.status.youtubeAppInstalled {
        case true?: "Installed. The extension does not change what the YouTube app shows."
        case false?: "Not found on this iPhone."
        case nil: "Could not tell."
        }
    }
}

private struct StatusHeader: View {
    let level: StatusLevel
    let copy: StatusCopy

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(tint)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(copy.headline).font(.headline)
                Text(copy.detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var icon: String {
        switch level {
        case .notSetUp: "circle.dashed"
        case .working: "checkmark.circle.fill"
        case .needsAttention: "exclamationmark.triangle.fill"
        }
    }

    private var tint: Color {
        switch level {
        case .notSetUp: .secondary
        case .working: .green
        case .needsAttention: .orange
        }
    }
}
