Pod::Spec.new do |s|
  s.name           = 'PdfNativeEngine'
  s.version        = '1.0.0'
  s.summary        = 'JSI PDF page rasterizer using PDFKit'
  s.description    = 'Renders PDF pages off the JS thread with PDFKit.'
  s.author         = 'Alghisi Alessandro Paolo'
  s.homepage       = 'https://github.com/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '*.{h,m,mm,swift,hpp,cpp}'
end
