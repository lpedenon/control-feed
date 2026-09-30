import NoBrainrotKit
import SwiftUI
import UIKit

enum Platform {
    @MainActor static func open(_ url: URL) async -> Bool {
        await UIApplication.shared.open(url)
    }

    @MainActor static func canOpen(_ url: URL) -> Bool {
        UIApplication.shared.canOpenURL(url)
    }

    @MainActor static func copy(_ text: String) {
        UIPasteboard.general.string = text
    }

    static var settingsURL: URL? {
        URL(string: UIApplication.openSettingsURLString)
    }
}

struct SystemTextCopier: TextCopying {
    @MainActor func copy(_ text: String) {
        Platform.copy(text)
    }
}

extension View {
    func inlineNavigationTitle() -> some View {
        navigationBarTitleDisplayMode(.inline)
    }

    func plainTextEntry() -> some View {
        textInputAutocapitalization(.never).autocorrectionDisabled()
    }
}
