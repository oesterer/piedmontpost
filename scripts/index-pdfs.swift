import Foundation
import PDFKit
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let files = try FileManager.default.contentsOfDirectory(atPath: root.path).filter { $0.lowercased().hasSuffix(".pdf") }.sorted()
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
  pages.append(["date": date, "file": "issues/" + name, "page": i+1, "text": text])
 }
}
let data = try JSONSerialization.data(withJSONObject: ["issues": issues, "pages": pages], options: [.sortedKeys])
try data.write(to: root.appendingPathComponent("dist/search-index.json"))
print("Indexed \(pages.count) pages across \(issues.count) issues; \(data.count) bytes")
