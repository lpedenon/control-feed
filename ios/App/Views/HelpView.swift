import NoBrainrotKit
import SwiftUI

struct HelpView: View {
    private static let repository = URL(string: "https://github.com/lpedenon/no-brainrot")!
    private static let privacy = URL(string: "https://github.com/lpedenon/no-brainrot/blob/master/PRIVACY.md")!

    var body: some View {
        List {
            Section("What it does") {
                Explainer("No Brainrot is a Safari extension. On YouTube in Safari it hides Shorts, the home feed, recommended videos and other endless lists, and it filters videos by channel, word and topic. This app is where you change the rules and see whether the extension is running.")
            }

            Section("Use YouTube in Safari") {
                CleanYouTubeAddress()
                Explainer(SafariFlow.shortcutDescription)
            }

            Section("What it does not do") {
                bullet("It does not change the YouTube app, other browsers or other websites.")
                bullet("It cannot switch itself on. iOS makes you turn the extension on and allow it on YouTube yourself.")
                bullet("It is not a lock. Anyone with your phone can turn the extension or the gate off.")
                bullet("YouTube's own Open App button still appears at the top of some pages. Tapping it opens the YouTube app.")
                bullet("Rules apply to the phone layout, m.youtube.com. If you ask Safari for the desktop site, the desktop rules apply only if you allow www.youtube.com too.")
            }

            Section("What the status means") {
                DetailRow(title: "Not set up yet", text: "The extension has not been in touch yet.")
                DetailRow(title: "Seen working", text: "The extension ran on a YouTube page in Safari lately, according to its own report.")
                DetailRow(title: "Not seen on YouTube lately", text: "The extension has not run on a YouTube page for a week or more. That is normal if you have not used YouTube in Safari. If you have, check that the extension is still on.")
                DetailRow(title: "Safari has not allowed YouTube", text: "The extension is running, but Safari says it may not read m.youtube.com. Allow it from the aA menu in Safari.")
                Explainer("The app never says your phone is protected. It can only report what the extension told it, and iOS gives it no other way to look.")
            }

            Section("Privacy") {
                Explainer("Your rules are stored on this iPhone and shared only between this app and its Safari extension. There is no account, no analytics and no server. The extension tells the app when it ran, which YouTube address type it ran on (m.youtube.com or www.youtube.com), its version and what Safari says about site access. It never sends what you watch or search for. The app also counts a few things you do in it, such as copying the YouTube address. Old URL handoff counts only mean iOS accepted an address, not that Safari opened or protection was on. Those counts stay on this iPhone unless you export them yourself.")
                Link("Read the privacy policy", destination: Self.privacy)
            }

            Section("About") {
                DetailRow(title: "Version", text: versionText)
                Link("Project page and source", destination: Self.repository)
            }
        }
        .navigationTitle("Help")
    }

    private var versionText: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "unknown"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "\(version) (\(build))"
    }

    private func bullet(_ text: String) -> some View {
        Label {
            Text(text).fixedSize(horizontal: false, vertical: true)
        } icon: {
            Image(systemName: "minus.circle").foregroundStyle(.secondary)
        }
        .font(.subheadline)
    }
}
