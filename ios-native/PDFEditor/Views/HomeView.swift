import SwiftUI
import UniformTypeIdentifiers

struct HomeView: View {
    @Bindable var state: AppState
    @State private var showImporter = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                header
                actions
                if !state.recents.isEmpty {
                    recents
                }
                features
            }
            .frame(maxWidth: Theme.contentMaxWidth)
            .padding(.horizontal, 20)
            .padding(.vertical, 32)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background.ignoresSafeArea())
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.pdf]) { result in
            if case let .success(url) = result {
                state.open(url: url)
            }
        }
        .fullScreenCover(item: $state.editor) { editor in
            NavigationStack {
                EditorView(model: editor) {
                    state.close()
                }
            }
            .preferredColorScheme(.dark)
            .tint(Theme.accent)
        }
        .alert(
            "Something went wrong",
            isPresented: Binding(
                get: { state.errorMessage != nil },
                set: { if !$0 { state.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(state.errorMessage ?? "")
        }
    }

    private var header: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text.fill")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(Theme.textInverse)
                .frame(width: 72, height: 72)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 20))
                .accessibilityHidden(true)
            Text("PDF Editor")
                .font(.system(size: 36, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
            Text("Open a PDF, tap any line and rewrite it. Add text and images, then save it as PDF, Word, HTML, CSV or an image.")
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.textSecondary)
        }
    }

    private var actions: some View {
        VStack(spacing: 12) {
            Button {
                showImporter = true
            } label: {
                Label("Open PDF", systemImage: "folder")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14))
                    .foregroundStyle(Theme.textInverse)
            }
            .accessibilityIdentifier("open-pdf")
            Button {
                state.openSample()
            } label: {
                Label("Try the sample document", systemImage: "sparkles")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.border))
                    .foregroundStyle(Theme.textPrimary)
            }
            .accessibilityIdentifier("open-sample")
        }
    }

    private var recents: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.textSecondary)
            ForEach(state.recents) { recent in
                Button {
                    state.open(recent: recent)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "doc")
                            .foregroundStyle(Theme.accent)
                        Text(recent.name)
                            .lineLimit(1)
                            .foregroundStyle(Theme.textPrimary)
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .font(.footnote)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .padding(.horizontal, 14)
                    .frame(minHeight: 48)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.border))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var features: some View {
        VStack(alignment: .leading, spacing: 14) {
            feature("hand.tap", "Tap a line to edit it", "The line opens in a text field. Type, then press Done.")
            feature("hand.draw", "Hold and drag to move", "Text and images can be placed anywhere on the page.")
            feature("arrow.uturn.backward", "Undo and redo", "Every change, including page rotation and deletion.")
            feature("square.and.arrow.down", "Save as", "PDF, Word, HTML, CSV, text, PNG or JPEG.")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.border))
    }

    private func feature(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(Theme.accent)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
    }
}
