import NoBrainrotKit
import SwiftUI

/// The first-run steps. Turning an extension on and allowing it on a site are
/// both things iOS reserves for the person, so the walkthrough explains where
/// to go and then watches for the extension to report in.
struct SetupWalkthroughView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let goToGate: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Explainer("No Brainrot works inside Safari. iOS keeps extensions off until you switch them on, so the first steps are yours to do.")
                }

                Section {
                    Step(number: 1, title: "Turn the extension on") {
                        Explainer("Open Settings, then Apps, then Safari, then Extensions, then No Brainrot, and switch it on. On iOS 17 it is Settings, Safari, Extensions.")
                        Explainer("You can also do it from Safari: tap the aA button in the address bar, choose Manage Extensions and switch No Brainrot on.")
                        if let url = Platform.settingsURL {
                            Button {
                                Task { _ = await Platform.open(url) }
                            } label: {
                                Label("Open Settings", systemImage: "gearshape")
                            }
                        }
                    }
                    Step(number: 2, title: "Allow it on YouTube") {
                        Explainer("In Safari, open m.youtube.com. Tap the aA button, choose No Brainrot, then Always Allow. Only you can grant this: the app cannot do it for you.")
                        CleanYouTubeAddress()
                    }
                    Step(number: 3, title: "Check that it worked") {
                        Explainer("Come back to this app. It shows when the extension last ran on a YouTube page. That is the only check the app has, so it can take a moment after you visit.")
                        Label(checkText, systemImage: checkIcon)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(model.status.level == .working ? Color.green : Color.secondary)
                        Button("Check again") { model.refresh() }
                    }
                    Step(number: 4, title: "Add the gate (optional)") {
                        Explainer(SafariFlow.shortcutDescription)
                        Button("Set up the gate") {
                            finish()
                            goToGate()
                        }
                    }
                } header: {
                    Text("Setup")
                }
            }
            .navigationTitle("Set up")
            .inlineNavigationTitle()
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: finish)
                }
            }
        }
        .onDisappear { model.finishSetup() }
    }

    private var checkText: String {
        switch model.status.extensionState {
        case .ranRecently: "The extension has run on YouTube in Safari."
        case .siteAccessMissing: "Safari says the extension is not allowed on YouTube yet."
        case .quiet: "Heard from the extension, but not on a YouTube page yet."
        case .neverSeen: "Not seen yet."
        }
    }

    private var checkIcon: String {
        model.status.level == .working ? "checkmark.circle.fill" : "circle.dashed"
    }

    private func finish() {
        model.finishSetup()
        dismiss()
    }
}
