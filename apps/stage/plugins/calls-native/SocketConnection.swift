import Darwin
import Foundation

final class SocketConnection {
    var didClose: ((Error?) -> Void)?

    private let filePath: String
    private let queue: DispatchQueue
    private var socketHandle: Int32 = -1
    private var readSource: DispatchSourceRead?
    private var writeSource: DispatchSourceWrite?
    private var pendingData: Data?
    private var byteIndex = 0
    private var writeCompletion: (() -> Void)?

    init(filePath: String, queue: DispatchQueue) {
        self.filePath = filePath
        self.queue = queue
    }

    deinit {
        readSource?.cancel()
        writeSource?.cancel()
        if socketHandle >= 0 {
            Darwin.close(socketHandle)
        }
    }

    func open() -> Bool {
        guard socketHandle < 0 else { return true }
        var address = sockaddr_un()
        let pathLength = filePath.utf8.count
        guard pathLength < MemoryLayout.size(ofValue: address.sun_path) else { return false }
        address.sun_family = sa_family_t(AF_UNIX)
        address.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
        withUnsafeMutablePointer(to: &address.sun_path) { pointer in
            filePath.withCString { path in
                _ = memcpy(pointer, path, pathLength + 1)
            }
        }
        let handle = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard handle >= 0 else { return false }
        var noSignal: Int32 = 1
        let configured = setsockopt(handle, SOL_SOCKET, SO_NOSIGPIPE, &noSignal, socklen_t(MemoryLayout<Int32>.size))
        let flags = fcntl(handle, F_GETFL)
        guard configured == 0, flags >= 0, fcntl(handle, F_SETFL, flags | O_NONBLOCK) == 0 else {
            Darwin.close(handle)
            return false
        }
        let connected = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.connect(handle, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard connected == 0 else {
            Darwin.close(handle)
            return false
        }
        socketHandle = handle
        let source = DispatchSource.makeReadSource(fileDescriptor: handle, queue: queue)
        source.setEventHandler { [weak self] in self?.read() }
        readSource = source
        source.resume()
        return true
    }

    func send(_ data: Data, completion: @escaping () -> Void) {
        queue.async { [weak self] in
            guard let self = self, self.socketHandle >= 0, self.pendingData == nil else {
                completion()
                return
            }
            self.pendingData = data
            self.byteIndex = 0
            self.writeCompletion = completion
            self.flush()
        }
    }

    func close() {
        readSource?.cancel()
        readSource = nil
        writeSource?.cancel()
        writeSource = nil
        if socketHandle >= 0 {
            Darwin.close(socketHandle)
            socketHandle = -1
        }
        completeWrite()
    }

    private func completeWrite() {
        pendingData = nil
        byteIndex = 0
        writeSource?.cancel()
        writeSource = nil
        let completion = writeCompletion
        writeCompletion = nil
        completion?()
    }

    private func fail(_ error: Error?) {
        close()
        didClose?(error)
    }

    private func read() {
        guard socketHandle >= 0 else { return }
        var byte: UInt8 = 0
        let count = Darwin.recv(socketHandle, &byte, 1, 0)
        if count == 0 {
            fail(nil)
        } else if count < 0 && errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR {
            fail(NSError(domain: NSPOSIXErrorDomain, code: Int(errno)))
        }
    }

    private func flush() {
        guard let data = pendingData, socketHandle >= 0 else { return }
        while byteIndex < data.count {
            let count = data.withUnsafeBytes { bytes -> Int in
                guard let base = bytes.baseAddress else { return 0 }
                return Darwin.send(socketHandle, base.advanced(by: byteIndex), min(10240, data.count - byteIndex), 0)
            }
            if count > 0 {
                byteIndex += count
            } else if count < 0 && (errno == EAGAIN || errno == EWOULDBLOCK) {
                waitForSpace()
                return
            } else if count < 0 && errno == EINTR {
                continue
            } else {
                fail(NSError(domain: NSPOSIXErrorDomain, code: Int(count == 0 ? EPIPE : errno)))
                return
            }
        }
        completeWrite()
    }

    private func waitForSpace() {
        guard writeSource == nil else { return }
        let source = DispatchSource.makeWriteSource(fileDescriptor: socketHandle, queue: queue)
        source.setEventHandler { [weak self] in self?.flush() }
        writeSource = source
        source.resume()
    }
}
