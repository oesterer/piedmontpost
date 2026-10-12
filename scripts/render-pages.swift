import Foundation
import PDFKit
import AppKit
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let files = try FileManager.default.contentsOfDirectory(atPath: root.appendingPathComponent("dist/issues").path).filter { $0.hasSuffix(".pdf") }.sorted()
for file in files {
 let date = String(file.dropLast(4))
 let target = root.appendingPathComponent("dist/pages/" + date)
 try FileManager.default.createDirectory(at: target, withIntermediateDirectories: true)
 guard let doc = PDFDocument(url: root.appendingPathComponent("dist/issues/" + file)) else { continue }
 for i in 0..<doc.pageCount {
  guard let page = doc.page(at: i) else { continue }
  let bounds = page.bounds(for: .mediaBox)
  let image = page.thumbnail(of: NSSize(width: 800, height: 800 * bounds.height / bounds.width), for: .mediaBox)
  guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let jpg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.8]) else { continue }
  try jpg.write(to: target.appendingPathComponent("\(i+1).jpg"))
 }
 print("Rendered \(date): \(doc.pageCount) pages")
}
