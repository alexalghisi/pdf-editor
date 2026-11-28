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
                    let arguments = ProcessInfo.processInfo.arguments
                    if arguments.contains("-openSample") || arguments.contains("-demoEdit") {
                        state.openSample()
                    }
                    if arguments.contains("-demoEdit") {
                        state.editor?.startDemoEdit()
                    }
                }
        }
    }
}
