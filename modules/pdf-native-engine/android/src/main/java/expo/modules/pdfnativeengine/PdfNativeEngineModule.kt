package expo.modules.pdfnativeengine

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class PdfNativeEngineModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PdfNativeEngine")

    AsyncFunction("getPageCount") { path: String ->
      openRenderer(path).use { it.pageCount }
    }

    AsyncFunction("getPageSize") { path: String, pageIndex: Int ->
      openRenderer(path).use { renderer ->
        renderer.openPage(pageIndex).use { page ->
          mapOf(
            "width" to page.width.toDouble(),
            "height" to page.height.toDouble()
          )
        }
      }
    }

    AsyncFunction("renderPage") { path: String, pageIndex: Int, scale: Double ->
      openRenderer(path).use { renderer ->
        renderer.openPage(pageIndex).use { page ->
          val width = (page.width * scale).toInt().coerceAtLeast(1)
          val height = (page.height * scale).toInt().coerceAtLeast(1)
          val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
          val canvas = Canvas(bitmap)
          canvas.drawColor(Color.WHITE)
          page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

          val output = File.createTempFile("pdf-page-$pageIndex-", ".png")
          FileOutputStream(output).use { stream ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
          }
          bitmap.recycle()

          mapOf(
            "uri" to output.absolutePath,
            "width" to width,
            "height" to height
          )
        }
      }
    }
  }

  private fun openRenderer(path: String): PdfRenderer {
    val file = File(path.removePrefix("file://"))
    val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    return PdfRenderer(descriptor)
  }
}
