import NoBrainrotKit
import SwiftUI

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// The few places where the app touches the system. Everything else builds on
/// any Apple platform, which keeps it checkable without an iPhone SDK.
enum Platform {
    @MainActor static func open(_ url: URL) async -> Bool {
        #if canImport(UIKit)
        return await UIApplication.shared.open(url)
        #else
        return NSWorkspace.shared.open(url)
        #endif
    }

    @MainActor static func canOpen(_ url: URL) -> Bool {
        #if canImport(UIKit)
        return UIApplication.shared.canOpenURL(url)
        #else
        return NSWorkspace.shared.urlForApplication(toOpen: url) != nil
        #endif
    }

    @MainActor static func copy(_ text: String) {
        #if canImport(UIKit)
        UIPasteboard.general.string = text
        #else
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        #endif
    }

    /// The Settings app, opened at this app's page (iOS offers no way to reach Safari's extension list directly).
    static var settingsURL: URL? {
        #if canImport(UIKit)
        return URL(string: UIApplication.openSettingsURLString)
        #else
        return nil
        #endif
    }
}

struct SystemURLOpener: URLOpening {
    @MainActor func open(_ url: URL) async -> Bool {
        await Platform.open(url)
    }
}

extension View {
    /// Small title above lists, the usual look for a screen inside a tab.
    func inlineNavigationTitle() -> some View {
        #if os(iOS)
        return navigationBarTitleDisplayMode(.inline)
        #else
        return self
        #endif
    }

    /// For typing names and words: no capital letters or corrections added behind the person's back.
    func plainTextEntry() -> some View {
        #if os(iOS)
        return textInputAutocapitalization(.never).autocorrectionDisabled()
        #else
        return autocorrectionDisabled()
        #endif
    }
}
