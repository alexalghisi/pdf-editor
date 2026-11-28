import Observation
import PDFKit
import UIKit

struct ExportedFile: Identifiable {
    let id = UUID()
    let url: URL
}

@Observable
final class EditorModel: Identifiable {
    private struct Command {
        let undo: () -> Void
        let redo: () -> Void
    }

    let id = UUID()
    let document: PDFDocument
    let title: String

    private(set) var elements: [EditElement] = []
    private(set) var selectedID: UUID?
    private(set) var editingID: UUID?
    private(set) var pageCount: Int
    private(set) var hasChanges = false
    var currentPageIndex = 0

    private var undoStack: [Command] = []
    private var redoStack: [Command] = []

    @ObservationIgnored private var snapshot: [EditElement]?
    @ObservationIgnored private var movingID: UUID?
    @ObservationIgnored var onLayoutChanged: (() -> Void)?

    init(document: PDFDocument, title: String) {
        self.document = document
        self.title = title
        self.pageCount = document.pageCount
    }

    var canUndo: Bool { !undoStack.isEmpty }
    var canRedo: Bool { !redoStack.isEmpty }

    var selected: EditElement? {
        guard let selectedID else { return nil }
        return elements.first { $0.id == selectedID }
    }

    var isEditing: Bool { editingID != nil }

    var editingText: String {
        guard let editingID, let element = elements.first(where: { $0.id == editingID }) else { return "" }
        return element.text
    }

    func handleTap(at point: CGPoint, on page: PDFPage) {
        let pageIndex = document.index(for: page)
        if isEditing {
            commitEditing()
        }
        if let hit = element(at: point, pageIndex: pageIndex) {
            if hit.id == selectedID, hit.isText {
                beginEditing(hit.id)
            } else {
                select(hit.id)
            }
            return
        }
        if let line = TextLayout.line(at: point, on: page) {
            snapshot = elements
            let element = EditElement(
                id: UUID(),
                pageIndex: pageIndex,
                kind: .replacement(originalBounds: line.bounds, originalText: line.text),
                frame: line.bounds,
                text: line.text,
                fontName: line.fontName,
                fontSize: line.fontSize,
                colorHex: line.colorHex
            )
            elements.append(element)
            selectedID = element.id
            editingID = element.id
            syncAnnotations()
            return
        }
        select(nil)
    }

    func element(at point: CGPoint, pageIndex: Int) -> EditElement? {
        elements.last { element in
            guard element.pageIndex == pageIndex else { return false }
            if element.frame.insetBy(dx: -6, dy: -6).contains(point) { return true }
            return element.coveredBounds?.contains(point) ?? false
        }
    }

    func select(_ id: UUID?) {
        guard selectedID != id else { return }
        selectedID = id
        syncAnnotations()
    }

    func beginEditing(_ id: UUID) {
        guard let element = elements.first(where: { $0.id == id }), element.isText else { return }
        snapshot = elements
        selectedID = id
        editingID = id
        syncAnnotations()
    }

    func updateEditingText(_ text: String) {
        guard let editingID, let index = elements.firstIndex(where: { $0.id == editingID }) else { return }
        guard elements[index].text != text else { return }
        elements[index].text = text
        resizeText(at: index)
        syncAnnotations()
    }

    func commitEditing() {
        guard let editingID else { return }
        let before = snapshot ?? elements
        snapshot = nil
        self.editingID = nil
        if let index = elements.firstIndex(where: { $0.id == editingID }) {
            let element = elements[index]
            switch element.kind {
            case let .replacement(originalBounds, originalText):
                let untouched = element.text == originalText && element.frame.origin == originalBounds.origin
                if untouched, !before.contains(where: { $0.id == editingID }) {
                    elements.remove(at: index)
                    selectedID = nil
                }
            case .addedText:
                if element.text.trimmingCharacters(in: .whitespaces).isEmpty {
                    elements.remove(at: index)
                    selectedID = nil
                }
            case .image:
                break
            }
        }
        let after = elements
        syncAnnotations()
        record(before: before, after: after)
    }

    func cancelEditing() {
        guard editingID != nil else { return }
        editingID = nil
        if let snapshot {
            elements = snapshot
        }
        snapshot = nil
        if let selectedID, !elements.contains(where: { $0.id == selectedID }) {
            self.selectedID = nil
        }
        syncAnnotations()
    }

    func addText() {
        guard let page = document.page(at: currentPageIndex) else { return }
        if isEditing {
            commitEditing()
        }
        let box = page.bounds(for: .mediaBox)
        let fontSize: CGFloat = 14
        let fontName = FontResolver.defaultName
        let text = "Text"
        let width = FontResolver.width(of: text, fontName: fontName, fontSize: fontSize)
        let height = FontResolver.font(named: fontName, size: fontSize).lineHeight
        snapshot = elements
        let element = EditElement(
            id: UUID(),
            pageIndex: currentPageIndex,
            kind: .addedText,
            frame: CGRect(x: box.midX - width / 2, y: box.midY, width: width, height: height),
            text: text,
            fontName: fontName,
            fontSize: fontSize,
            colorHex: 0x111111
        )
        elements.append(element)
        selectedID = element.id
        editingID = element.id
        syncAnnotations()
    }

    func addImage(_ data: Data) {
        guard let page = document.page(at: currentPageIndex), let image = UIImage(data: data) else { return }
        guard image.size.width > 0, image.size.height > 0 else { return }
        if isEditing {
            commitEditing()
        }
        let ratio = min(1, 1600 / max(image.size.width, image.size.height))
        let target = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let normalized = UIGraphicsImageRenderer(size: target, format: format).pngData { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        let box = page.bounds(for: .mediaBox)
        let width = min(box.width * 0.5, image.size.width)
        let height = width * image.size.height / image.size.width
        let element = EditElement(
            id: UUID(),
            pageIndex: currentPageIndex,
            kind: .image(normalized),
            frame: CGRect(x: box.midX - width / 2, y: box.midY - height / 2, width: width, height: height),
            text: "",
            fontName: FontResolver.defaultName,
            fontSize: 0,
            colorHex: 0
        )
        var after = elements
        after.append(element)
        apply(after, selecting: element.id)
    }

    func deleteSelected() {
        guard let selectedID, let index = elements.firstIndex(where: { $0.id == selectedID }) else { return }
        editingID = nil
        snapshot = nil
        var after = elements
        if case .replacement = after[index].kind, !after[index].text.isEmpty {
            after[index].text = ""
        } else {
            after.remove(at: index)
        }
        apply(after, selecting: nil)
    }

    func scaleSelected(by factor: CGFloat) {
        guard let selectedID, let index = elements.firstIndex(where: { $0.id == selectedID }) else { return }
        var after = elements
        if after[index].isText {
            let size = min(max(after[index].fontSize * factor, 4), 200)
            after[index].fontSize = (size * 2).rounded() / 2
            after[index] = Self.resized(after[index])
        } else {
            let frame = after[index].frame
            let width = min(max(frame.width * factor, 12), 4000)
            let height = width * frame.height / max(frame.width, 1)
            after[index].frame = CGRect(
                x: frame.midX - width / 2,
                y: frame.midY - height / 2,
                width: width,
                height: height
            )
        }
        apply(after, selecting: selectedID, keepEditing: true)
    }

    func setSelectedColor(_ hex: UInt32) {
        guard let selectedID, let index = elements.firstIndex(where: { $0.id == selectedID }) else { return }
        guard elements[index].isText, elements[index].colorHex != hex else { return }
        var after = elements
        after[index].colorHex = hex
        apply(after, selecting: selectedID, keepEditing: true)
    }

    func beginMove(at point: CGPoint, on page: PDFPage) -> Bool {
        let pageIndex = document.index(for: page)
        guard let hit = element(at: point, pageIndex: pageIndex) else { return false }
        if isEditing {
            commitEditing()
        }
        guard elements.contains(where: { $0.id == hit.id }) else { return false }
        snapshot = elements
        movingID = hit.id
        selectedID = hit.id
        syncAnnotations()
        return true
    }

    func move(by delta: CGSize) {
        guard let movingID, let index = elements.firstIndex(where: { $0.id == movingID }) else { return }
        elements[index].frame = elements[index].frame.offsetBy(dx: delta.width, dy: delta.height)
        syncAnnotations()
    }

    func endMove() {
        guard movingID != nil else { return }
        movingID = nil
        let before = snapshot ?? elements
        snapshot = nil
        record(before: before, after: elements)
    }

    func rotateCurrentPage() {
        guard let page = document.page(at: currentPageIndex) else { return }
        if isEditing {
            commitEditing()
        }
        let rotate: (Int) -> Void = { [weak self] degrees in
            page.rotation = ((page.rotation + degrees) % 360 + 360) % 360
            self?.hasChanges = true
            self?.onLayoutChanged?()
        }
        rotate(90)
        push(Command(undo: { rotate(-90) }, redo: { rotate(90) }))
    }

    func deleteCurrentPage() {
        guard document.pageCount > 1, let page = document.page(at: currentPageIndex) else { return }
        if isEditing {
            commitEditing()
        }
        let index = currentPageIndex
        let before = elements
        let after: [EditElement] = elements.compactMap { element in
            if element.pageIndex == index { return nil }
            var moved = element
            if moved.pageIndex > index { moved.pageIndex -= 1 }
            return moved
        }
        let redo: () -> Void = { [weak self] in
            guard let self else { return }
            self.clearAnnotations()
            self.document.removePage(at: index)
            self.elements = after
            self.selectedID = nil
            self.pageCount = self.document.pageCount
            self.currentPageIndex = min(index, self.document.pageCount - 1)
            self.hasChanges = true
            self.syncAnnotations()
            self.onLayoutChanged?()
        }
        let undo: () -> Void = { [weak self] in
            guard let self else { return }
            self.clearAnnotations()
            self.document.insert(page, at: index)
            self.elements = before
            self.selectedID = nil
            self.pageCount = self.document.pageCount
            self.currentPageIndex = index
            self.syncAnnotations()
            self.onLayoutChanged?()
        }
        redo()
        push(Command(undo: undo, redo: redo))
    }

    func undo() {
        if isEditing {
            cancelEditing()
            return
        }
        guard let command = undoStack.popLast() else { return }
        command.undo()
        redoStack.append(command)
    }

    func redo() {
        if isEditing {
            commitEditing()
        }
        guard let command = redoStack.popLast() else { return }
        command.redo()
        undoStack.append(command)
    }

    func textPages() -> [TextPage] {
        (0..<document.pageCount).compactMap { index in
            guard let page = document.page(at: index) else { return nil }
            let lines = TextLayout.merge(
                lines: TextLayout.lines(of: page),
                elements: elements.filter { $0.pageIndex == index }
            )
            return TextPage(size: page.bounds(for: .mediaBox).size, lines: lines)
        }
    }

    func exportPDF() -> Data {
        prepareForExport()
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 612, height: 792))
        return renderer.pdfData { context in
            for index in 0..<document.pageCount {
                guard let page = document.page(at: index) else { continue }
                let size = Self.displaySize(of: page)
                context.beginPage(withBounds: CGRect(origin: .zero, size: size), pageInfo: [:])
                Self.draw(page, size: size, in: context.cgContext)
            }
        }
    }

    func exportImage(pageIndex: Int, scale: CGFloat = 2) -> UIImage? {
        prepareForExport()
        guard let page = document.page(at: pageIndex) else { return nil }
        let size = Self.displaySize(of: page)
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            Self.draw(page, size: size, in: context.cgContext)
        }
    }

    func export(_ format: ExportFormat) throws -> ExportedFile {
        let data: Data
        switch format {
        case .pdf:
            data = exportPDF()
        case .docx:
            data = Exporters.docx(textPages())
        case .html:
            data = Data(Exporters.html(textPages(), title: title).utf8)
        case .csv:
            data = Data(Exporters.csv(textPages()).utf8)
        case .txt:
            data = Data(Exporters.text(textPages()).utf8)
        case .png:
            data = exportImage(pageIndex: currentPageIndex)?.pngData() ?? Data()
        case .jpg:
            data = exportImage(pageIndex: currentPageIndex)?.jpegData(compressionQuality: 0.92) ?? Data()
        }
        guard !data.isEmpty else { throw CocoaError(.fileWriteUnknown) }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent(exportName).appendingPathExtension(format.fileExtension)
        try data.write(to: url, options: .atomic)
        if format == .pdf {
            hasChanges = false
        }
        return ExportedFile(url: url)
    }

    var exportName: String {
        let base = (title as NSString).deletingPathExtension
        let cleaned = base.components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>")).joined(separator: "-")
        return cleaned.isEmpty ? "document" : cleaned
    }

    private func prepareForExport() {
        if isEditing {
            commitEditing()
        }
        select(nil)
    }

    private func apply(_ after: [EditElement], selecting id: UUID?, keepEditing: Bool = false) {
        let before = elements
        if !keepEditing {
            editingID = nil
            snapshot = nil
        }
        elements = after
        selectedID = id
        syncAnnotations()
        guard !keepEditing || editingID == nil else {
            hasChanges = true
            return
        }
        record(before: before, after: after)
    }

    private func record(before: [EditElement], after: [EditElement]) {
        guard before != after else { return }
        hasChanges = true
        push(
            Command(
                undo: { [weak self] in self?.restore(before) },
                redo: { [weak self] in self?.restore(after) }
            )
        )
    }

    private func push(_ command: Command) {
        undoStack.append(command)
        redoStack.removeAll()
        hasChanges = true
    }

    private func restore(_ state: [EditElement]) {
        elements = state
        if let selectedID, !state.contains(where: { $0.id == selectedID }) {
            self.selectedID = nil
        }
        hasChanges = true
        syncAnnotations()
    }

    private func resizeText(at index: Int) {
        elements[index] = Self.resized(elements[index])
    }

    private static func resized(_ element: EditElement) -> EditElement {
        var result = element
        let width = FontResolver.width(of: element.text, fontName: element.fontName, fontSize: element.fontSize)
        let lineHeight = FontResolver.font(named: element.fontName, size: element.fontSize).lineHeight
        let height = element.coveredBounds == nil ? lineHeight : max(element.frame.height, 1)
        result.frame = CGRect(x: element.frame.minX, y: element.frame.minY, width: max(width, 8), height: height)
        return result
    }

    private func clearAnnotations() {
        for index in 0..<document.pageCount {
            guard let page = document.page(at: index) else { continue }
            for annotation in page.annotations where annotation is ElementAnnotation {
                page.removeAnnotation(annotation)
            }
        }
    }

    private func syncAnnotations() {
        clearAnnotations()
        for element in elements {
            guard let page = document.page(at: element.pageIndex) else { continue }
            page.addAnnotation(ElementAnnotation(element: element, isSelected: element.id == selectedID))
        }
    }

    private static func displaySize(of page: PDFPage) -> CGSize {
        let box = page.bounds(for: .mediaBox)
        let rotated = page.rotation % 180 != 0
        return rotated ? CGSize(width: box.height, height: box.width) : box.size
    }

    private static func draw(_ page: PDFPage, size: CGSize, in context: CGContext) {
        context.saveGState()
        context.translateBy(x: 0, y: size.height)
        context.scaleBy(x: 1, y: -1)
        page.draw(with: .mediaBox, to: context)
        context.restoreGState()
    }
}
