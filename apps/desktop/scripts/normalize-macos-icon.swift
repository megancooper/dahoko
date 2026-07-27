import AppKit
import CoreGraphics
import Foundation

// Legacy macOS .icns artwork uses an 824 px footprint inside its 1024 px
// canvas, leaving 100 px of transparent space on every edge.
private let canvasSize = 1024
private let artworkSize = 824
private let artworkInset = (canvasSize - artworkSize) / 2

guard CommandLine.arguments.count == 3 else {
  FileHandle.standardError.write(
    Data("Usage: normalize-macos-icon.swift <input.png> <output.png>\n".utf8)
  )
  exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard let inputImage = NSImage(contentsOf: inputURL) else {
  FileHandle.standardError.write(
    Data("Unable to read \(inputURL.path)\n".utf8)
  )
  exit(1)
}

var sourceRect = NSRect(origin: .zero, size: inputImage.size)
guard
  let sourceImage = inputImage.cgImage(
    forProposedRect: &sourceRect,
    context: nil,
    hints: nil
  ),
  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
  let context = CGContext(
    data: nil,
    width: canvasSize,
    height: canvasSize,
    bitsPerComponent: 8,
    bytesPerRow: canvasSize * 4,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  )
else {
  FileHandle.standardError.write(
    Data("Unable to create the icon canvas\n".utf8)
  )
  exit(1)
}

context.clear(
  CGRect(x: 0, y: 0, width: canvasSize, height: canvasSize)
)
context.interpolationQuality = .high
context.draw(
  sourceImage,
  in: CGRect(
    x: artworkInset,
    y: artworkInset,
    width: artworkSize,
    height: artworkSize
  )
)

guard let outputImage = context.makeImage() else {
  FileHandle.standardError.write(
    Data("Unable to render the normalized icon\n".utf8)
  )
  exit(1)
}

let representation = NSBitmapImageRep(cgImage: outputImage)
representation.size = NSSize(width: canvasSize, height: canvasSize)

guard let pngData = representation.representation(using: .png, properties: [:])
else {
  FileHandle.standardError.write(
    Data("Unable to encode the normalized icon\n".utf8)
  )
  exit(1)
}

try FileManager.default.createDirectory(
  at: outputURL.deletingLastPathComponent(),
  withIntermediateDirectories: true
)
try pngData.write(to: outputURL, options: .atomic)
