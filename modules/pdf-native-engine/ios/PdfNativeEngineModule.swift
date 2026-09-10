import ExpoModulesCore
import PDFKit
import UIKit

enum PdfNativeEngineError: Error {
  case invalidDocument
  case invalidPage
  case renderFailed
}

public class PdfNativeEngineModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PdfNativeEngine")

    AsyncFunction("getPageCount") { (path: String) -> Int in
      guard let document = PDFDocument(url: URL(fileURLWithPath: Self.normalized(path))) else {
        throw PdfNativeEngineError.invalidDocument
      }
      return document.pageCount
    }

    AsyncFunction("getPageSize") { (path: String, pageIndex: Int) -> [String: Double] in
      guard
        let document = PDFDocument(url: URL(fileURLWithPath: Self.normalized(path))),
        let page = document.page(at: pageIndex)
      else {
        throw PdfNativeEngineError.invalidPage
      }
      let bounds = page.bounds(for: .mediaBox)
      return ["width": bounds.width, "height": bounds.height]
    }

    AsyncFunction("renderPage") { (path: String, pageIndex: Int, scale: Double) -> [String: Any] in
      guard
        let document = PDFDocument(url: URL(fileURLWithPath: Self.normalized(path))),
        let page = document.page(at: pageIndex)
      else {
        throw PdfNativeEngineError.invalidPage
      }

      let media = page.bounds(for: .mediaBox)
      let width = Int((media.width * scale).rounded())
      let height = Int((media.height * scale).rounded())
      let format = UIGraphicsImageRendererFormat.default()
      format.scale = 1
      format.opaque = true
      let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format)
      let image = renderer.image { context in
        UIColor.white.setFill()
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.cgContext.saveGState()
        context.cgContext.translateBy(x: 0, y: CGFloat(height))
        context.cgContext.scaleBy(x: scale, y: -scale)
        page.draw(with: .mediaBox, to: context.cgContext)
        context.cgContext.restoreGState()
      }

      guard let data = image.pngData() else {
        throw PdfNativeEngineError.renderFailed
      }
      let output = FileManager.default.temporaryDirectory
        .appendingPathComponent("pdf-page-\(pageIndex)-\(Int(scale * 100)).png")
      try data.write(to: output, options: .atomic)
      return [
        "uri": output.path,
        "width": width,
        "height": height,
      ]
    }
  }

  private static func normalized(_ path: String) -> String {
    if path.hasPrefix("file://") {
      return URL(string: path)?.path ?? path
    }
    return path
  }
}
