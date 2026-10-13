import Foundation
import PDFKit
import AppKit
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let map = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("work/article-extraction/article-map.json"))) as! [String: Any]
guard let doc = PDFDocument(url: root.appendingPathComponent(map["source"] as! String)) else { fatalError("Cannot open PDF") }
let target = root.appendingPathComponent("dist/articles/2026-10-07/images")
try FileManager.default.createDirectory(at: target, withIntermediateDirectories: true)
var count = 0
for article in map["articles"] as! [[String: Any]] {
 for (index, item) in (article["images"] as? [[String: Any]] ?? []).enumerated() {
  let p = item["page"] as! Int
  let r = item["rect"] as! [Double]
  let rect = CGRect(x: r[0], y: r[1], width: r[2], height: r[3])
  guard let page = doc.page(at: p-1), let ctx = CGContext(data: nil, width: Int(rect.width*2), height: Int(rect.height*2), bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { fatalError("Cannot render crop") }
  ctx.setFillColor(CGColor(gray: 1, alpha: 1)); ctx.fill(CGRect(x: 0,y: 0,width: rect.width*2,height: rect.height*2))
  ctx.scaleBy(x: 2, y: 2); ctx.translateBy(x: -rect.minX, y: -rect.minY)
  page.draw(with: .mediaBox, to: ctx)
  guard let image = ctx.makeImage(), let data = NSBitmapImageRep(cgImage: image).representation(using: .jpeg, properties: [.compressionFactor: 0.85]) else { fatalError("Cannot encode crop") }
  try data.write(to: target.appendingPathComponent("\(article["slug"] as! String)-\(index+1).jpg"))
  count += 1
 }
}
print("Rendered \(count) original newspaper photos and illustrations")
