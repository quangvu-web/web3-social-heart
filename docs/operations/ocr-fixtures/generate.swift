// Offline synthetic OCR fixtures. No network, Telegram data, credentials or AI calls.
import AppKit
import Foundation

struct Fixture {
    let id: String
    let width: Int
    let height: Int
    let fontSize: CGFloat
    let expectedText: String
    var file: String { "\(id).png" }
}
let directory = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "docs/operations/ocr-fixtures", isDirectory: true)
let fixtures = [
    Fixture(id: "vietnamese", width: 1024, height: 512, fontSize: 36,
            expectedText: "FUN Profile\nCộng đồng yêu thương và kết nối\nHẹn gặp lúc 19:00 MYT"),
    Fixture(id: "synthetic-links", width: 1024, height: 768, fontSize: 30,
            expectedText: "Nội dung kiểm thử, không phải lời mời thật\nhttps://example.invalid/fixture\n@fixture_bot\n123 456 789"),
    Fixture(id: "dense-small", width: 1024, height: 1024, fontSize: 16,
            expectedText: (1...24).map { "Dòng \($0): thực hành biết ơn, giữ tâm bình an, kết nối LoveHUB." }.joined(separator: "\n")),
    Fixture(id: "no-text", width: 512, height: 512, fontSize: 24, expectedText: "")
]
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
for fixture in fixtures {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: fixture.width,
        pixelsHigh: fixture.height, bitsPerSample: 8, samplesPerPixel: 4,
        hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    bitmap.size = NSSize(width: fixture.width, height: fixture.height)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: fixture.width, height: fixture.height).fill()
    let style = NSMutableParagraphStyle()
    style.lineSpacing = 12
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fixture.fontSize), .foregroundColor: NSColor.black,
        .paragraphStyle: style
    ]
    let lines = fixture.expectedText.components(separatedBy: "\n")
    for (index, line) in lines.enumerated() {
        let y = CGFloat(fixture.height) - 50 - CGFloat(index + 1) * (fixture.fontSize + 16)
        (line as NSString).draw(at: NSPoint(x: 36, y: y), withAttributes: attributes)
    }
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent(fixture.file))
}
print("Created \(fixtures.count) synthetic PNG fixtures locally. No model evaluation performed.")
