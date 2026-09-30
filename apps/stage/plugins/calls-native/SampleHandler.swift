import Foundation
import ReplayKit

final class SampleHandler: RPBroadcastSampleHandler {
    private let queue = DispatchQueue(label: "box.stage.broadcast")
    private var connection: SocketConnection?
    private var uploader: SampleUploader?
    private var connectTimer: DispatchSourceTimer?
    private var finished = false
    private var frameCount = 0

    override init() {
        super.init()
        guard let group = Bundle.main.object(forInfoDictionaryKey: "RTCAppGroupIdentifier") as? String,
              let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return }
        let client = SocketConnection(filePath: container.appendingPathComponent("rtc_SSFD").path, queue: queue)
        client.didClose = { [weak self] error in
            guard let self = self else { return }
            self.finish(error ?? self.broadcastError("Screen sharing stopped"))
        }
        connection = client
        uploader = SampleUploader(connection: client)
    }

    deinit {
        connectTimer?.cancel()
    }

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        frameCount = 0
        queue.async { [weak self] in self?.openConnection() }
    }

    override func broadcastFinished() {
        queue.async { [weak self] in self?.cleanup() }
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video else { return }
        frameCount = (frameCount + 1) % 3
        guard frameCount == 0 else { return }
        autoreleasepool { uploader?.send(sample: sampleBuffer) }
    }

    private func broadcastError(_ message: String) -> NSError {
        NSError(domain: RPRecordingErrorDomain, code: 10001, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private func finish(_ error: Error?) {
        guard !finished else { return }
        cleanup()
        finishBroadcastWithError(error ?? broadcastError("Screen sharing stopped"))
    }

    private func cleanup() {
        guard !finished else { return }
        finished = true
        connectTimer?.cancel()
        connectTimer = nil
        uploader?.stop()
        connection?.close()
        DarwinNotificationCenter.post(.broadcastStopped)
    }

    private func openConnection() {
        guard !finished else { return }
        guard connection != nil else {
            finish(broadcastError("Stage screen sharing is not configured"))
            return
        }
        let deadline = DispatchTime.now() + .seconds(15)
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(100))
        timer.setEventHandler { [weak self] in
            guard let self = self, !self.finished else { return }
            if self.connection?.open() == true {
                self.connectTimer?.cancel()
                self.connectTimer = nil
                self.uploader?.start()
                DarwinNotificationCenter.post(.broadcastStarted)
            } else if DispatchTime.now() >= deadline {
                self.finish(self.broadcastError("Screen sharing could not connect to Stage"))
            }
        }
        connectTimer = timer
        timer.resume()
    }
}
