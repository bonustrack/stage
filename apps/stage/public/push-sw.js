self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

function convIdOfTopic(topic) {
  var match = /\/g-([0-9a-fA-F]+)\//.exec(topic || '');
  return match ? match[1].toLowerCase() : null;
}

function payloadOf(event) {
  try {
    var json = event.data ? event.data.json() : null;
    if (json && json.data) return json.data;
    return json || {};
  } catch {
    return {};
  }
}

function windowClients() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
}

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function showGenericCard(convId) {
  var clients = await windowClients();
  if (clients.some(function (c) { return c.visibilityState === 'visible' && c.focused; })) return;
  if (clients.length > 0) {
    await wait(3000);
    var existing = await self.registration.getNotifications({ tag: convId });
    if (existing.length > 0) return;
  }
  await self.registration.showNotification('Stage', {
    body: 'New message',
    tag: convId,
    data: { convId: convId },
  });
}

self.addEventListener('push', function (event) {
  var convId = convIdOfTopic(payloadOf(event).topic);
  if (!convId) return;
  event.waitUntil(showGenericCard(convId));
});

async function openConversation(convId) {
  var url = convId ? '/#/channel/' + convId : '/';
  var clients = await windowClients();
  var target = clients[0];
  if (target) {
    await target.focus();
    if (typeof target.navigate === 'function') {
      try { await target.navigate(url); } catch { await self.clients.openWindow(url); }
    }
    return;
  }
  await self.clients.openWindow(url);
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var data = event.notification.data || {};
  event.waitUntil(openConversation(data.convId));
});
