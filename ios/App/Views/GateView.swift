import NoBrainrotKit
import SwiftUI

/// The optional gate: an iPhone Shortcut that sends the person from the YouTube
/// app to YouTube in Safari. The app cannot create it or check for it, so this
/// screen is instructions and honest limits.
struct GateView: View {
    @Environment(AppModel.self) private var model
    static let address = "https://m.youtube.com"
    static let shortcutsURL = URL(string: "shortcuts://")!
    @State private var copied = false

    var body: some View {
        List {
            Section {
                Explainer("When you open the YouTube app, an iPhone Shortcut can send you straight to YouTube in Safari, where No Brainrot hides the distractions. It is a nudge you choose to set up, not a lock: you can switch it off in Shortcuts whenever you like.")
            } header: {
                Text("What the gate does")
            }

            Section {
                Step(number: 1, title: "Open Shortcuts") {
                    Explainer("Open the Shortcuts app and tap Automation.")
                    Button {
                        Task { _ = await Platform.open(Self.shortcutsURL) }
                    } label: {
                        Label("Open Shortcuts", systemImage: "arrow.up.forward.app")
                    }
                }
                Step(number: 2, title: "Start a new automation") {
                    Explainer("Tap New Automation (the plus button), then choose App.")
                }
                Step(number: 3, title: "Choose YouTube") {
                    Explainer("Tap Choose, pick YouTube, make sure Is Opened is selected, then tap Next.")
                }
                Step(number: 4, title: "Add the Open URLs action") {
                    Explainer("Tap Add Action, search for Open URLs and add it. Set its address to:")
                    Text(Self.address)
                        .font(.body.monospaced())
                        .textSelection(.enabled)
                    Button {
                        Platform.copy(Self.address)
                        copied = true
                    } label: {
                        Label(copied ? "Copied" : "Copy address", systemImage: copied ? "checkmark" : "doc.on.doc")
                    }
                }
                Step(number: 5, title: "Run it without asking") {
                    Explainer("Tap Next, choose Run Immediately so it does not ask every time, then tap Done.")
                }
            } header: {
                Text("Set it up in Shortcuts")
            } footer: {
                Text("iOS asks you to do these steps yourself. No app is allowed to create an automation for you.")
            }

            Section {
                Toggle(isOn: gateBinding) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("I have set this up")
                        Text("A note for you. iOS does not let apps see your automations, so the Status tab shows it as your note, never as confirmed.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                Button {
                    Task { await model.openCleanYouTube() }
                } label: {
                    Label("Open YouTube in Safari", systemImage: "safari")
                }
                if let failure = model.launchFailure {
                    Banner(text: failure, dismiss: model.dismissLaunchFailure)
                }
            } header: {
                Text("Check it")
            } footer: {
                Text("Then open the YouTube app. If the gate works, Safari opens on YouTube instead.")
            }

            Section {
                Explainer("iOS can hand the address straight back to the YouTube app. In Safari, Messages or Notes, touch and hold a youtube.com link and choose Open in Safari once. iOS should then keep opening YouTube links in Safari, until you touch and hold again and choose Open in YouTube. How iOS remembers this can differ between versions.")
            } header: {
                Text("If the YouTube app keeps opening")
            }

            Section {
                limit("Nothing changes inside the YouTube app. Shorts and recommendations stay there.")
                limit("Links from other apps, such as Messages, may still open the YouTube app.")
                limit("You, or anyone with your phone, can turn it off in Shortcuts. It is a nudge, not a block.")
            } header: {
                Text("What it cannot do")
            }
        }
        .navigationTitle("Gate")
    }

    private var gateBinding: Binding<Bool> {
        Binding(get: { model.gateMarkedSetUp }, set: { model.setGateMarked($0) })
    }

    private func limit(_ text: String) -> some View {
        Label {
            Text(text).fixedSize(horizontal: false, vertical: true)
        } icon: {
            Image(systemName: "minus.circle").foregroundStyle(.secondary)
        }
        .font(.subheadline)
    }
}
