import PhotosUI
import SwiftUI

struct EditorView: View {
    let model: EditorModel
    let onClose: () -> Void

    @State private var showSaveAs = false
    @State private var showDiscard = false
    @State private var photoItem: PhotosPickerItem?
    @FocusState private var fieldFocused: Bool

    var body: some View {
        PDFKitView(model: model)
            .ignoresSafeArea(.container, edges: .bottom)
            .background(Theme.canvas)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                bottomBar
            }
            .navigationTitle(model.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.surface, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        if model.hasChanges {
                            showDiscard = true
                        } else {
                            onClose()
                        }
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .accessibilityLabel("Close document")
                }
                ToolbarItemGroup(placement: .primaryAction) {
                    Button {
                        model.undo()
                    } label: {
                        Image(systemName: "arrow.uturn.backward")
                    }
                    .disabled(!model.canUndo && !model.isEditing)
                    .accessibilityLabel("Undo")
                    Button {
                        model.redo()
                    } label: {
                        Image(systemName: "arrow.uturn.forward")
                    }
                    .disabled(!model.canRedo)
                    .accessibilityLabel("Redo")
                    Button {
                        showSaveAs = true
                    } label: {
                        Image(systemName: "square.and.arrow.down")
                    }
                    .accessibilityLabel("Save as")
                    .accessibilityIdentifier("save-as")
                }
            }
            .sheet(isPresented: $showSaveAs) {
                SaveAsSheet(model: model)
            }
            .confirmationDialog("Close without saving?", isPresented: $showDiscard, titleVisibility: .visible) {
                Button("Save as…") { showSaveAs = true }
                Button("Discard changes", role: .destructive) { onClose() }
                Button("Keep editing", role: .cancel) {}
            }
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                Task {
                    let data = try? await item.loadTransferable(type: Data.self)
                    await MainActor.run {
                        if let data {
                            model.addImage(data)
                        }
                        photoItem = nil
                    }
                }
            }
            .onChange(of: model.editingID) { _, id in
                fieldFocused = id != nil
            }
    }

    @ViewBuilder private var bottomBar: some View {
        VStack(spacing: 0) {
            Divider().overlay(Theme.border)
            Group {
                if model.isEditing {
                    editingBar
                } else if let selected = model.selected {
                    selectionBar(for: selected)
                } else {
                    toolsBar
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(maxWidth: 720)
        }
        .frame(maxWidth: .infinity)
        .background(Theme.surface)
    }

    private var editingBar: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                TextField(
                    "Text",
                    text: Binding(
                        get: { model.editingText },
                        set: { model.updateEditingText($0) }
                    )
                )
                .focused($fieldFocused)
                .submitLabel(.done)
                .onSubmit { model.commitEditing() }
                .padding(.horizontal, 12)
                .frame(minHeight: Theme.touchTarget)
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(Theme.textPrimary)
                .accessibilityIdentifier("edit-field")

                iconButton("xmark", label: "Cancel edit") { model.cancelEditing() }
                iconButton("checkmark", label: "Apply edit", prominent: true) { model.commitEditing() }
            }
            styleRow
        }
        .onAppear { fieldFocused = true }
    }

    private func selectionBar(for element: EditElement) -> some View {
        HStack(spacing: 8) {
            if element.isText {
                iconButton("pencil", label: "Edit text") { model.beginEditing(element.id) }
                styleRow
            } else {
                iconButton("minus.magnifyingglass", label: "Smaller") { model.scaleSelected(by: 0.8) }
                iconButton("plus.magnifyingglass", label: "Larger") { model.scaleSelected(by: 1.25) }
                Spacer(minLength: 0)
            }
            iconButton("trash", label: "Delete", tint: Theme.danger) { model.deleteSelected() }
        }
    }

    private var styleRow: some View {
        HStack(spacing: 8) {
            iconButton("textformat.size.smaller", label: "Smaller text") { model.scaleSelected(by: 1 / 1.1) }
            iconButton("textformat.size.larger", label: "Larger text") { model.scaleSelected(by: 1.1) }
            Spacer(minLength: 0)
            ForEach(Theme.swatches, id: \.self) { hex in
                Button {
                    model.setSelectedColor(hex)
                } label: {
                    Circle()
                        .fill(Color(hex: hex))
                        .frame(width: 26, height: 26)
                        .overlay(
                            Circle().strokeBorder(
                                model.selected?.colorHex == hex ? Theme.accent : Theme.border,
                                lineWidth: 2
                            )
                        )
                        .frame(width: 36, height: Theme.touchTarget)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Text colour")
            }
        }
    }

    private var toolsBar: some View {
        HStack(spacing: 8) {
            iconButton("textformat", label: "Add text") { model.addText() }
                .accessibilityIdentifier("add-text")
            PhotosPicker(selection: $photoItem, matching: .images) {
                Image(systemName: "photo")
                    .frame(width: Theme.touchTarget, height: Theme.touchTarget)
                    .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 10))
                    .foregroundStyle(Theme.textPrimary)
            }
            .accessibilityLabel("Add image")
            iconButton("rotate.right", label: "Rotate page") { model.rotateCurrentPage() }
            iconButton("trash", label: "Delete page", tint: Theme.danger) { model.deleteCurrentPage() }
                .disabled(model.pageCount < 2)
                .opacity(model.pageCount < 2 ? 0.4 : 1)
            Spacer(minLength: 0)
            Text("\(min(model.currentPageIndex + 1, model.pageCount)) / \(model.pageCount)")
                .font(.footnote.monospacedDigit().weight(.semibold))
                .foregroundStyle(Theme.textSecondary)
                .accessibilityLabel("Page \(model.currentPageIndex + 1) of \(model.pageCount)")
        }
    }

    private func iconButton(
        _ symbol: String,
        label: String,
        prominent: Bool = false,
        tint: Color = Theme.textPrimary,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .frame(width: Theme.touchTarget, height: Theme.touchTarget)
                .background(
                    prominent ? Theme.accent : Theme.surfaceRaised,
                    in: RoundedRectangle(cornerRadius: 10)
                )
                .foregroundStyle(prominent ? Theme.textInverse : tint)
        }
        .accessibilityLabel(label)
    }
}
