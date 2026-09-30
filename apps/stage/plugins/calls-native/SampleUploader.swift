import CFNetwork
import CoreImage
import Foundation
import ImageIO
import ReplayKit

final class SampleUploader {
    private let imageContext = CIContext(options: [.cacheIntermediates: false])
    private let connection: SocketConnection
    private let lock = NSLock()
    private var enabled = false
    private var sending = false

    init(connection: SocketConnection) {
        self.connection = connection
    }

    func start() {
        lock.lock()
        enabled = true
        lock.unlock()
    }

    func stop() {
        lock.lock()
        enabled = false
        lock.unlock()
    }

    func send(sample buffer: CMSampleBuffer) {
        lock.lock()
        guard enabled && !sending else {
            lock.unlock()
            return
        }
        sending = true
        lock.unlock()
        guard let data = prepare(sample: buffer) else {
            completeFrame()
            return
        }
        connection.send(data) { [weak self] in self?.completeFrame() }
    }

    private func completeFrame() {
        lock.lock()
        sending = false
        lock.unlock()
    }

    private func prepare(sample buffer: CMSampleBuffer) -> Data? {
        guard let imageBuffer = CMSampleBufferGetImageBuffer(buffer) else { return nil }
        let locked = CVPixelBufferLockBaseAddress(imageBuffer, .readOnly)
        guard locked == kCVReturnSuccess else { return nil }
        defer { CVPixelBufferUnlockBaseAddress(imageBuffer, .readOnly) }
        let width = max(1, CVPixelBufferGetWidth(imageBuffer) / 2)
        let height = max(1, CVPixelBufferGetHeight(imageBuffer) / 2)
        let image = CIImage(cvPixelBuffer: imageBuffer).transformed(by: CGAffineTransform(scaleX: 0.5, y: 0.5))
        let colorSpace = image.colorSpace ?? CGColorSpaceCreateDeviceRGB()
        let options: [CIImageRepresentationOption: Float] = [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.8]
        guard let jpeg = imageContext.jpegRepresentation(of: image, colorSpace: colorSpace, options: options) else { return nil }
        let orientation = (CMGetAttachment(buffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber)?.uintValue ?? 1
        let response = CFHTTPMessageCreateResponse(nil, 200, nil, kCFHTTPVersion1_1).takeRetainedValue()
        CFHTTPMessageSetHeaderFieldValue(response, "Content-Length" as CFString, String(jpeg.count) as CFString)
        CFHTTPMessageSetHeaderFieldValue(response, "Buffer-Width" as CFString, String(width) as CFString)
        CFHTTPMessageSetHeaderFieldValue(response, "Buffer-Height" as CFString, String(height) as CFString)
        CFHTTPMessageSetHeaderFieldValue(response, "Buffer-Orientation" as CFString, String(orientation) as CFString)
        CFHTTPMessageSetBody(response, jpeg as CFData)
        return CFHTTPMessageCopySerializedMessage(response)?.takeRetainedValue() as Data?
    }
}
