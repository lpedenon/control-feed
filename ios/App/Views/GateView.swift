import NoBrainrotKit
import SwiftUI

struct GateView: View {
    @Environment(AppModel.self) private var model
    static let shortcutsURL = URL(string: "shortcuts://")!

    var body: some View {
        List {
            Section {
                Explainer(SafariFlow.shortcutDescription)
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
                    CleanYouTubeAddress()
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
            } header: {
                Text("Check it")
            } footer: {
                Text(SafariFlow.shortcutCheck)
            }

            Section {
                limit("Nothing changes inside the YouTube app. Shorts and recommendations stay there.")
                limit("Links from other apps, such as Messages, may still open the YouTube app.")
                limit("You, or anyone with your phone, can turn it off in Shortcuts. It is a nudge, not a block.")
            } header: {
                Text("What it cannot do")
            }

            Section {
                Explainer("The YouTube app has its own Shorts feed limit. At 0 minutes, YouTube reminds you to stop as soon as you start scrolling Shorts in its app, where No Brainrot cannot reach.")
                Explainer("In the YouTube app, tap You, then Settings, Time management and Shorts feed limit. Turn it on and set it to 0 minutes.")
                limit("YouTube decides who gets it. It may not be offered on your account, in your country or in your version of the app, and the menu names can differ.")
                limit("YouTube's reminder can be dismissed or ignored with a tap. It is a nudge, not a lock.")
                limit("No Brainrot cannot switch it on or check whether it is on.")
                limit("If an app-opened automation is set up, switch it off in Shortcuts while you change this. Only turn it back on if its destination is what you want.")
            } header: {
                Text("Optional: YouTube's Shorts limit")
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
