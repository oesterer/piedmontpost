import Foundation
import PDFKit
import AppKit
struct PDFLine {
 let id: Int
 let text: String
 let box: CGRect
 let size: CGFloat
}
func cleanText(_ value: String) -> String {
 value.replacingOccurrences(of: "([\\p{L}])[-\u{00AD}]\\s*\\n\\s*([\\p{L}])", with: "$1$2", options: .regularExpression).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
}
func detectedArticles(_ page: PDFPage) -> [[String: Any]] {
 let bounds = page.bounds(for: .mediaBox)
 guard let selection = page.selection(for: bounds) else { return [] }
 let lines: [PDFLine] = selection.selectionsByLine().enumerated().compactMap { id, selection in
  let text = cleanText(selection.string ?? "")
  if text.isEmpty { return nil }
  var size: CGFloat = 0
  if let attributed = selection.attributedString {
   attributed.enumerateAttribute(NSAttributedString.Key("NSFont"), in: NSRange(location: 0, length: attributed.length)) { value, _, _ in
    if let font = value as? NSFont { size = max(size, font.pointSize) }
   }
  }
  return PDFLine(id: id, text: text, box: selection.bounds(for: page), size: size)
 }
 let sizes = lines.filter { $0.text.count > 18 && $0.size > 0 && $0.size < 16 }.map { $0.size }.sorted()
 let bodySize: CGFloat = sizes.isEmpty ? 10 : sizes[sizes.count/2]
 let excluded: Set<String> = ["piedmont post", "opinion", "sports", "local items", "schools", "features", "arts & entertainment", "real estate", "inside", "our city", "our news", "our paper", "our post", "read it in the post", "advertise in the post", "letters - main", "letters - cont", "classifieds"]
 let candidates = lines.filter { line in
  let lower = line.text.lowercased()
  return line.size >= max(15, bodySize*1.65) && line.size < bodySize*4.5 && line.box.minY > bounds.height*0.035 && line.box.maxY < bounds.height*0.965 && line.box.minX >= 0 && line.text.count >= 5 && line.text.rangeOfCharacter(from: .letters) != nil && !excluded.contains(lower) && !lower.contains("all city edition") && !lower.contains("advertise") && !lower.contains("piedmont post piedmont post") && !lower.hasPrefix("by ") && !lower.contains("www.") && !lower.contains("http")
 }.sorted { a,b in abs(a.box.midY-b.box.midY) > 3 ? a.box.midY > b.box.midY : a.box.minX < b.box.minX }
 var groups: [[PDFLine]] = []
 for candidate in candidates {
  if groups.contains(where: { $0.contains(where: { $0.text == candidate.text && abs($0.box.midY-candidate.box.midY)<3 && abs($0.box.minX-candidate.box.minX)<3 }) }) { continue }
  if let index = groups.indices.last(where: { index in
   guard let last = groups[index].last else { return false }
   let overlap = min(last.box.maxX,candidate.box.maxX)-max(last.box.minX,candidate.box.minX)
   let distance = last.box.midY-candidate.box.midY
   return abs(last.size-candidate.size)<2 && distance>last.size*0.6 && distance<last.size*1.7 && overlap>min(last.box.width,candidate.box.width)*0.35
  }) { groups[index].append(candidate) } else { groups.append([candidate]) }
 }
 // Infer text-column margins from repeated positions of ordinary body lines.
 let body = lines.filter { $0.size <= bodySize*1.35 && $0.text.count>12 && $0.box.width>bounds.width*0.10 && $0.box.width<bounds.width*0.45 }
 var columns: [CGFloat] = []
 for x in body.map({ $0.box.minX }).sorted() {
  if let last = columns.last, x-last < bounds.width*0.05 { continue }
  columns.append(x)
 }
 if columns.isEmpty { columns = [bounds.minX] }
 struct Heading { let title: String; let box: CGRect; let left: CGFloat; let right: CGFloat }
 let headings: [Heading] = groups.compactMap { group in
  let box = group.reduce(CGRect.null) { $0.union($1.box) }
  let title = group.map { $0.text }.joined(separator: " ")
  if title.count < 8 { return nil }
  let left = columns.last(where: { $0 <= box.minX+3 }) ?? box.minX
  let right = columns.first(where: { $0 > box.maxX-3 }).map { $0-5 } ?? bounds.maxX
  return Heading(title: title, box: box, left: left, right: right)
 }
 var bodies = Array(repeating: [PDFLine](), count: headings.count)
 for line in lines where line.size <= bodySize*1.4 {
  if line.text.hasPrefix("Continued from") || line.text.hasPrefix("See ") || line.text.hasPrefix("By ") { continue }
  let eligible = headings.indices.filter { index in
   let h = headings[index]
   return line.box.midX>=h.left && line.box.midX<h.right && line.box.midY<h.box.minY+2
  }
  if let index = eligible.min(by: { headings[$0].box.minY-line.box.midY < headings[$1].box.minY-line.box.midY }) { bodies[index].append(line) }
 }
 return headings.indices.compactMap { index in
  let body = bodies[index].sorted { $0.id<$1.id }
  let text = cleanText(body.map { $0.text }.joined(separator: "\n"))
  // Short display slogans and most advertising blocks have little accompanying text.
  if text.count<100 { return nil }
  return ["title": headings[index].title, "text": text, "source": "detected"]
 }
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let files = try FileManager.default.contentsOfDirectory(atPath: root.path).filter { $0.lowercased().hasSuffix(".pdf") }.sorted()
// Reviewed metadata takes precedence over automatically detected headline regions.
let reportURL = root.appendingPathComponent("work/article-extraction/report.json")
let layoutURL = root.appendingPathComponent("work/article-extraction/layout.json")
var articleReport: [String: Any] = [:]
var layoutPages: [[String: Any]] = []
if let data = try? Data(contentsOf: reportURL), let report = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { articleReport = report }
if let data = try? Data(contentsOf: layoutURL), let layout = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] { layoutPages = layout }
var issues = [[String: Any]]()
var pages = [[String: Any]]()
for file in files {
 let parts = String(file.prefix(8)).split(separator: "-")
 guard parts.count == 3, let pdf = PDFDocument(url: root.appendingPathComponent(file)) else { continue }
 let date = "20\(parts[2])-\(parts[0])-\(parts[1])"
 let name = date + ".pdf"
 let target = root.appendingPathComponent("dist/issues/" + name)
 if FileManager.default.fileExists(atPath: target.path) { try FileManager.default.removeItem(at: target) }
 try FileManager.default.copyItem(at: root.appendingPathComponent(file), to: target)
 issues.append(["date": date, "file": "issues/" + name, "pages": pdf.pageCount])
 for i in 0..<pdf.pageCount {
  let raw = pdf.page(at: i)?.string ?? ""
  let joined = raw.replacingOccurrences(of: "([\\p{L}])[-\u{00AD}]\\s*\\n\\s*([\\p{L}])", with: "$1$2", options: .regularExpression)
  let text = joined.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
  var record: [String: Any] = ["date": date, "file": "issues/" + name, "page": i+1, "text": text]
  if let pdfPage = pdf.page(at: i) {
   let detected = detectedArticles(pdfPage)
   if !detected.isEmpty { record["articles"] = detected }
  }
  if articleReport["issue"] as? String == date, i < layoutPages.count {
   let lines = layoutPages[i]["lines"] as? [[String: Any]] ?? []
   var articles = [[String: Any]]()
   for article in articleReport["articles"] as? [[String: Any]] ?? [] {
    let refs = article["sourceLines"] as? [String] ?? []
    let ids = refs.compactMap { ref -> Int? in
     let parts = ref.split(separator: ":")
     return parts.count == 2 && Int(parts[0]) == i+1 ? Int(parts[1]) : nil
    }
    if ids.isEmpty { continue }
    let body = ids.compactMap { id -> String? in id < lines.count ? lines[id]["text"] as? String : nil }.joined(separator: "\n")
    let cleaned = body.replacingOccurrences(of: "([\\p{L}])[-\u{00AD}]\\s*\\n\\s*([\\p{L}])", with: "$1$2", options: .regularExpression).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    articles.append(["title": article["title"] as? String ?? "", "text": cleaned, "source": "reviewed"])
   }
   if !articles.isEmpty { record["articles"] = articles }
  }
  pages.append(record)
 }
}
let review = pages.map { record -> [String: Any] in
 ["date": record["date"] ?? "", "page": record["page"] ?? 0, "titles": (record["articles"] as? [[String: Any]] ?? []).map { ["title": $0["title"] ?? "", "source": $0["source"] ?? ""] }]
}
let reviewDirectory = root.appendingPathComponent("work")
try FileManager.default.createDirectory(at: reviewDirectory, withIntermediateDirectories: true)
try JSONSerialization.data(withJSONObject: review, options: [.prettyPrinted, .sortedKeys]).write(to: reviewDirectory.appendingPathComponent("headline-review.json"))
let data = try JSONSerialization.data(withJSONObject: ["issues": issues, "pages": pages], options: [.sortedKeys])
try data.write(to: root.appendingPathComponent("dist/search-index.json"))
print("Indexed \(pages.count) pages across \(issues.count) issues; \(data.count) bytes")
