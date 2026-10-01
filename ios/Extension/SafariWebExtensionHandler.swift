import NoBrainrotKit
import os
import SafariServices

/// Receives the extension's messages. The extension pulls: it sends the rules it
/// holds and gets back the app's, and this class only passes each message to
/// `ExtensionEntryPoint`. It never logs a message, because it carries the
/// person's lists of channels and words.
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private static let log = Logger(subsystem: "io.github.lpedenon.nobrainrot", category: "extension")

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem
        let message = request?.userInfo?[SFExtensionMessageKey]

        let info = Bundle.main.infoDictionary
        let answer = ExtensionEntryPoint.answer(
            to: message,
            appGroup: info?["NBAppGroupIdentifier"] as? String ?? "",
            appVersion: info?["CFBundleShortVersionString"] as? String ?? "unknown"
        )
        if let object = answer as? [String: Any], object["ok"] as? Bool == false {
            Self.log.error("Refused a message from the extension: \(object["error"] as? String ?? "unknown", privacy: .public)")
        }

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: answer]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
