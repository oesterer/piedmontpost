import Foundation
import PDFKit
let path = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "10-07-26 Post - Web.pdf"
guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else { fatalError("Cannot open PDF") }
var pages = [[String: Any]]()
for i in 0..<doc.pageCount {
 guard let page = doc.page(at: i), let selection = page.selection(for: page.bounds(for: .mediaBox)) else { continue }
 var lines = [[String: Any]]()
 for (index, line) in selection.selectionsByLine().enumerated() {
  let rect = line.bounds(for: page)
  let text = line.string ?? ""
  var fonts = [Double]()
  if let attributed = line.attributedString { attributed.enumerateAttribute(NSAttributedString.Key("NSFont"), in: NSRange(location: 0, length: attributed.length)) { value, _, _ in
   if let font = value as? NSFont { fonts.append(Double(font.pointSize)) }
  } }
  lines.append(["id": index, "text": text, "x": rect.minX, "y": rect.minY, "w": rect.width, "h": rect.height, "font": fonts.max() ?? 0])
 }
 let bounds = page.bounds(for: .mediaBox)
 pages.append(["page": i+1, "width": bounds.width, "height": bounds.height, "text": page.string ?? "", "lines": lines])
}
let data = try JSONSerialization.data(withJSONObject: pages, options: [.prettyPrinted,.sortedKeys])
try data.write(to: URL(fileURLWithPath: "work/article-extraction/layout.json"))
print("Extracted \(pages.count) pages")
