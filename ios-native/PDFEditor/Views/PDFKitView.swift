import PDFKit
import SwiftUI
import UIKit

struct PDFKitView: UIViewRepresentable {
    let model: EditorModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.backgroundColor = UIColor(hex: 0x07090D)
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.pageShadowsEnabled = true
        view.document = model.document
        view.autoScales = true
        view.accessibilityIdentifier = "pdf-canvas"

        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tap.delegate = context.coordinator
        view.addGestureRecognizer(tap)

        let press = UILongPressGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handlePress(_:))
        )
        press.minimumPressDuration = 0.25
        press.delegate = context.coordinator
        view.addGestureRecognizer(press)

        context.coordinator.attach(to: view, keeping: [tap, press])
        return view
    }

    func updateUIView(_ uiView: PDFView, context: Context) {}

    static func dismantleUIView(_ uiView: PDFView, coordinator: Coordinator) {
        coordinator.detach()
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        private let model: EditorModel
        private weak var view: PDFView?
        private weak var movingPage: PDFPage?
        private var lastPoint: CGPoint = .zero
        private var ownRecognizers: [UIGestureRecognizer] = []

        init(model: EditorModel) {
            self.model = model
        }

        func attach(to view: PDFView, keeping recognizers: [UIGestureRecognizer]) {
            self.view = view
            ownRecognizers = recognizers
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(pageChanged(_:)),
                name: .PDFViewPageChanged,
                object: view
            )
            model.onLayoutChanged = { [weak view] in
                view?.layoutDocumentView()
            }
            DispatchQueue.main.async { [weak self, weak view] in
                guard let self, let view else { return }
                self.disableTextSelection(in: view)
            }
        }

        func detach() {
            NotificationCenter.default.removeObserver(self)
            model.onLayoutChanged = nil
        }

        private func disableTextSelection(in view: UIView) {
            for recognizer in view.gestureRecognizers ?? [] where recognizer is UILongPressGestureRecognizer {
                if !ownRecognizers.contains(where: { $0 === recognizer }) {
                    recognizer.isEnabled = false
                }
            }
            for subview in view.subviews {
                disableTextSelection(in: subview)
            }
        }

        @objc func pageChanged(_ notification: Notification) {
            guard let view, let page = view.currentPage, let document = view.document else { return }
            let index = document.index(for: page)
            if index != NSNotFound, model.currentPageIndex != index {
                model.currentPageIndex = index
            }
        }

        @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
            guard recognizer.state == .ended, let view else { return }
            let location = recognizer.location(in: view)
            guard let page = view.page(for: location, nearest: false) else {
                if model.isEditing {
                    model.commitEditing()
                }
                model.select(nil)
                return
            }
            model.handleTap(at: view.convert(location, to: page), on: page)
        }

        @objc func handlePress(_ recognizer: UILongPressGestureRecognizer) {
            guard let view else { return }
            let location = recognizer.location(in: view)
            switch recognizer.state {
            case .began:
                guard let page = view.page(for: location, nearest: false) else { return }
                let point = view.convert(location, to: page)
                if model.beginMove(at: point, on: page) {
                    movingPage = page
                    lastPoint = point
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                }
            case .changed:
                guard let page = movingPage else { return }
                let point = view.convert(location, to: page)
                model.move(by: CGSize(width: point.x - lastPoint.x, height: point.y - lastPoint.y))
                lastPoint = point
            case .ended, .cancelled, .failed:
                guard movingPage != nil else { return }
                movingPage = nil
                model.endMove()
            default:
                break
            }
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            true
        }
    }
}
