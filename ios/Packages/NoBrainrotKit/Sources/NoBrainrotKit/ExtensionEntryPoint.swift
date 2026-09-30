import Foundation

/// What the Safari extension's native handler does with a message. The handler
/// itself only passes the message through, so this is the part tests can reach.
public enum ExtensionEntryPoint {
    /// - Parameters:
    ///   - message: the object Safari delivered, or nil.
    ///   - appGroup: the App Group shared with the app.
    ///   - defaults: storage to use instead of the App Group, for tests.
    /// - Returns: the answer as Foundation objects, ready to hand back to Safari.
    public static func answer(
        to message: Any?,
        appGroup: String,
        appVersion: String,
        defaults: UserDefaults? = nil,
        now: @escaping @Sendable () -> Date = { Date() }
    ) -> Any {
        let store = defaults.map(SharedDefaultsStore.init(defaults:)) ?? SharedDefaultsStore.appGroup(appGroup)
        guard let store else {
            return ["ok": false, "error": SyncRefusal.storageFailed.rawValue] as [String: Any]
        }
        return SyncService(settingsStore: store, contactStore: store, appVersion: appVersion, now: now)
            .handle(foundation: message)
    }
}
