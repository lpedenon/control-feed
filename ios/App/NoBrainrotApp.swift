import NoBrainrotKit
import SwiftUI

@main
struct NoBrainrotApp: App {
    @State private var model = AppModel(dependencies: .live())

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
        }
    }
}
