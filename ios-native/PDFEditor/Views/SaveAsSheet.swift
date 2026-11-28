import SwiftUI

struct SaveAsSheet: View {
    let model: EditorModel
    @Environment(\.dismiss) private var dismiss
    @State private var exported: ExportedFile?
    @State private var failed = false

    var body: some View {
        NavigationStack {
            List(ExportFormat.allCases) { format in
                Button {
                    save(format)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: format.symbol)
                            .frame(width: 28)
                            .foregroundStyle(Theme.accent)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(format.label)
                                .foregroundStyle(Theme.textPrimary)
                            Text(".\(format.fileExtension)")
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Image(systemName: "square.and.arrow.up")
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .frame(minHeight: Theme.touchTarget)
                    .contentShape(Rectangle())
                }
                .listRowBackground(Theme.surfaceRaised)
                .accessibilityIdentifier("save-as-\(format.rawValue)")
            }
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .navigationTitle("Save as")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .tint(Theme.accent)
        .presentationDetents([.medium, .large])
        .sheet(item: $exported) { file in
            ShareSheet(url: file.url)
        }
        .alert("The file could not be saved", isPresented: $failed) {
            Button("OK", role: .cancel) {}
        }
    }

    private func save(_ format: ExportFormat) {
        do {
            exported = try model.export(format)
        } catch {
            failed = true
        }
    }
}
