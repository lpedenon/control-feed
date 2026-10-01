import NoBrainrotKit
import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab: AppRoute = .status
    @State private var showingSetup = false

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { StatusView(showSetup: $showingSetup) }
                .tabItem { Label("Status", systemImage: "checkmark.circle") }
                .tag(AppRoute.status)
            NavigationStack { RulesView() }
                .tabItem { Label("Rules", systemImage: "slider.horizontal.3") }
                .tag(AppRoute.rules)
            NavigationStack { GateView() }
                .tabItem { Label("Gate", systemImage: "arrow.turn.up.right") }
                .tag(AppRoute.gate)
            NavigationStack { HelpView() }
                .tabItem { Label("Help", systemImage: "questionmark.circle") }
                .tag(AppRoute.help)
        }
        .onChange(of: scenePhase) { _, phase in
            // The extension may have reported in, or adopted newer rules, while the app was away.
            if phase == .active { model.refresh() }
        }
        .onOpenURL { url in
            if let route = AppRoute(url: url) { tab = route }
        }
        .task {
            if !model.setupSeen { showingSetup = true }
        }
        .sheet(isPresented: $showingSetup) {
            SetupWalkthroughView(goToGate: {
                tab = .gate
            })
        }
    }
}
