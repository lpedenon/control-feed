import Foundation
import NoBrainrotKit

extension AppDependencies {
    /// The app's real surroundings: storage shared with the Safari extension
    /// through the App Group named in Info.plist, and the system for opening links.
    @MainActor
    static func live(bundle: Bundle = .main) -> AppDependencies {
        let group = bundle.object(forInfoDictionaryKey: "NBAppGroupIdentifier") as? String ?? ""
        let shared = SharedDefaultsStore.appGroup(group)
        // Without the group the rules still work inside the app, but Safari's extension cannot see them.
        let store = shared ?? SharedDefaultsStore(defaults: .standard)
        return AppDependencies(
            repository: SettingsRepository(store: store),
            contacts: store,
            sharedStorageAvailable: shared != nil,
            opener: SystemURLOpener(),
            youtubeAppInstalled: { Platform.canOpen(URL(string: "youtube://")!) },
            preferences: .standard
        )
    }
}
