import SwiftUI

@main
struct PDFEditorApp: App {
    @State private var state = AppState()

    var body: some Scene {
        WindowGroup {
            HomeView(state: state)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
                .onOpenURL { url in
                    state.open(url: url)
                }
                .onAppear {
                    if ProcessInfo.processInfo.arguments.contains("-openSample") {
                        state.openSample()
                    }
                }
        }
    }
}
