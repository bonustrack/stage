import Foundation
import Security
import UserNotifications
import XMTP

struct StagePushAccount: Decodable {
  let id: String
  let address: String
  let inboxId: String
  let dbDir: String
  let env: String
}

enum StagePushStore {
  static let manifestName = "stage-push-accounts.json"
  static let keychainService = "app:no-auth"

  static func appGroup() -> String? {
    Bundle.main.object(forInfoDictionaryKey: "StageAppGroup") as? String
  }

  static func container(for group: String) -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
  }

  static func accounts(in container: URL) -> [StagePushAccount] {
    guard let data = try? Data(contentsOf: container.appendingPathComponent(manifestName)) else { return [] }
    return (try? JSONDecoder().decode([StagePushAccount].self, from: data)) ?? []
  }

  static func dbKey(accountId: String, group: String) -> Data? {
    let account = Data("xmtp.dbEncryptionKey.\(accountId)".utf8)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrGeneric as String: account,
      kSecAttrAccount as String: account,
      kSecAttrAccessGroup as String: group,
      kSecMatchLimit as String: kSecMatchLimitOne,
      kSecReturnData as String: kCFBooleanTrue as Any,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
          let stored = item as? Data,
          let encoded = String(data: stored, encoding: .utf8) else { return nil }
    return Data(base64Encoded: encoded)
  }
}

enum StagePushDecryptor {
  static func text(topic: String, envelope: Data) async -> String? {
    guard let group = StagePushStore.appGroup(),
          let container = StagePushStore.container(for: group) else { return nil }
    for account in StagePushStore.accounts(in: container) {
      guard let key = StagePushStore.dbKey(accountId: account.id, group: group),
            let client = try? await openClient(for: account, key: key, container: container),
            let conversation = try? await client.conversations.findConversationByTopic(topic: topic) else { continue }
      guard let message = try? await conversation.processMessage(messageBytes: envelope),
            message.senderInboxId != client.inboxID else { return nil }
      return preview(of: message)
    }
    return nil
  }

  private static func openClient(for account: StagePushAccount, key: Data, container: URL) async throws -> Client {
    let api = ClientOptions.Api(env: account.env == "production" ? .production : .dev, isSecure: true)
    let options = ClientOptions(
      api: api,
      dbEncryptionKey: key,
      dbDirectory: container.appendingPathComponent(account.dbDir).path,
      deviceSyncEnabled: false
    )
    let identity = PublicIdentity(kind: .ethereum, identifier: account.address)
    return try await Client.build(publicIdentity: identity, options: options, inboxId: account.inboxId)
  }

  private static func preview(of message: DecodedMessage) -> String? {
    guard let encoded = try? message.encodedContent, encoded.type.typeID == "text",
          let text = String(data: encoded.content, encoding: .utf8) else { return nil }
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}

enum StagePushTopic {
  static func conversationId(of topic: String) -> String? {
    guard let start = topic.range(of: "/g-") else { return nil }
    let rest = topic[start.upperBound...]
    guard let end = rest.firstIndex(of: "/") else { return nil }
    let id = rest[..<end].lowercased()
    let isHex = !id.isEmpty && id.allSatisfy { $0.isHexDigit }
    return isHex ? id : nil
  }
}

final class NotificationService: UNNotificationServiceExtension {
  private let lock = NSLock()
  private var handler: ((UNNotificationContent) -> Void)?
  private var content: UNMutableNotificationContent?
  private var work: Task<Void, Never>?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
      contentHandler(request.content)
      return
    }
    let info = request.content.userInfo
    let topic = info["topic"] as? String
    content.title = "Stage"
    content.body = "New message"
    content.sound = .default
    if let topic, let convId = StagePushTopic.conversationId(of: topic) {
      content.threadIdentifier = convId
      content.userInfo["body"] = ["convId": convId]
    }
    lock.lock()
    handler = contentHandler
    self.content = content
    lock.unlock()
    guard let topic,
          let encoded = info["encryptedMessage"] as? String,
          let envelope = Data(base64Encoded: encoded) else {
      finish()
      return
    }
    work = Task { [weak self] in
      let text = await StagePushDecryptor.text(topic: topic, envelope: envelope)
      if let text { self?.update(body: text) }
      self?.finish()
    }
  }

  override func serviceExtensionTimeWillExpire() {
    work?.cancel()
    finish()
  }

  private func update(body: String) {
    lock.lock()
    content?.body = body
    lock.unlock()
  }

  private func finish() {
    lock.lock()
    let deliver = handler
    let final = content
    handler = nil
    content = nil
    lock.unlock()
    if let deliver, let final { deliver(final) }
  }
}
