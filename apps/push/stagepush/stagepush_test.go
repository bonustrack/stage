package stagepush

import (
	"context"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/xmtp/example-notification-server-go/pkg/interfaces"
	"github.com/xmtp/xmtpd/pkg/topic"
	"go.uber.org/zap"
)

const (
	keyA      = "aa00000000000000000000000000000000000000000000000000000000000001"
	keyB      = "bb00000000000000000000000000000000000000000000000000000000000002"
	convHex   = "0123456789abcdef0123456789abcdef"
	convTopic = "/xmtp/mls/1/g-" + convHex + "/proto"
)

type memoryGroups struct {
	mu      sync.Mutex
	byInstl map[string]string
}

func (g *memoryGroups) Join(_ context.Context, id, group string) (bool, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if stored, found := g.byInstl[id]; found {
		return stored == group, nil
	}
	g.byInstl[id] = group
	return true, nil
}

func (g *memoryGroups) Members(_ context.Context, group string, limit int) ([]string, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	var out []string
	for id, stored := range g.byInstl {
		if stored == group && len(out) < limit {
			out = append(out, id)
		}
	}
	return out, nil
}

type fakeSubscriptions struct {
	interfaces.Subscriptions
	byTopic map[string][]string
}

func (f fakeSubscriptions) GetSubscriptions(_ context.Context, t *topic.Topic, _ int) ([]interfaces.Subscription, error) {
	var out []interfaces.Subscription
	for _, id := range f.byTopic[string(t.Bytes())] {
		out = append(out, interfaces.Subscription{InstallationId: id, IsActive: true})
	}
	return out, nil
}

type fakeInstallations struct {
	interfaces.Installations
}

func (fakeInstallations) GetInstallations(_ context.Context, ids []string) ([]interfaces.Installation, error) {
	var out []interfaces.Installation
	for _, id := range ids {
		out = append(out, interfaces.Installation{
			Id:                id,
			DeliveryMechanism: interfaces.DeliveryMechanism{Kind: interfaces.FCM, Token: "token-" + id},
		})
	}
	return out, nil
}

type recordingDelivery struct {
	mu   sync.Mutex
	sent []interfaces.SendRequest
}

func (d *recordingDelivery) CanDeliver(req interfaces.SendRequest) bool {
	return req.Installation.DeliveryMechanism.Kind == interfaces.FCM
}

func (d *recordingDelivery) Send(_ context.Context, req interfaces.SendRequest) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.sent = append(d.sent, req)
	return nil
}

func (d *recordingDelivery) targets() []string {
	d.mu.Lock()
	defer d.mu.Unlock()
	var out []string
	for _, req := range d.sent {
		out = append(out, req.Installation.Id)
	}
	return out
}

type harness struct {
	service  *Service
	delivery *recordingDelivery
	mux      *http.ServeMux
}

func newHarness(t *testing.T, subscribed ...string) *harness {
	t.Helper()
	id, err := hex.DecodeString(convHex)
	require.NoError(t, err)
	parsed := topic.NewTopic(topic.TopicKindGroupMessagesV1, id)
	delivery := &recordingDelivery{}
	service := New(
		zap.NewNop(),
		&memoryGroups{byInstl: map[string]string{}},
		fakeSubscriptions{byTopic: map[string][]string{string(parsed.Bytes()): subscribed}},
		fakeInstallations{},
		[]interfaces.Delivery{delivery},
	)
	mux := http.NewServeMux()
	for path, handler := range service.Routes() {
		mux.Handle(path, handler)
	}
	return &harness{service: service, delivery: delivery, mux: mux}
}

func (h *harness) post(path, body string) int {
	rec := httptest.NewRecorder()
	h.mux.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, strings.NewReader(body)))
	return rec.Code
}

func join(id, key string) string {
	return `{"installationId":"` + id + `","groupKey":"` + key + `"}`
}

func clear(id, key, topic string) string {
	return `{"installationId":"` + id + `","groupKey":"` + key + `","topic":"` + topic + `"}`
}

func TestJoinBindsAnInstallationToOneGroupOnly(t *testing.T) {
	h := newHarness(t)
	require.Equal(t, http.StatusOK, h.post(JoinPath, join("a1", keyA)))
	require.Equal(t, http.StatusOK, h.post(JoinPath, join("a1", keyA)))
	require.Equal(t, http.StatusConflict, h.post(JoinPath, join("a1", keyB)))
}

func TestClearReachesOnlyTheSameGroupsOtherSubscribedDevices(t *testing.T) {
	h := newHarness(t, "a1", "a2", "b1")
	require.Equal(t, http.StatusOK, h.post(JoinPath, join("a1", keyA)))
	require.Equal(t, http.StatusOK, h.post(JoinPath, join("a2", keyA)))
	require.Equal(t, http.StatusOK, h.post(JoinPath, join("a3", keyA)))
	require.Equal(t, http.StatusOK, h.post(JoinPath, join("b1", keyB)))

	require.Equal(t, http.StatusOK, h.post(ClearPath, clear("a1", keyA, convTopic)))

	require.Equal(t, []string{"a2"}, h.delivery.targets())
	sent := h.delivery.sent[0]
	require.Equal(t, ClearTopicPrefix+convHex, sent.Topic)
	require.True(t, sent.Subscription.IsSilent)
	require.Empty(t, sent.EncryptedMessage)
}

func TestClearWithAnotherKeySendsNothing(t *testing.T) {
	h := newHarness(t, "a1", "a2")
	require.Equal(t, http.StatusOK, h.post(JoinPath, join("a1", keyA)))
	require.Equal(t, http.StatusOK, h.post(JoinPath, join("a2", keyA)))

	require.Equal(t, http.StatusOK, h.post(ClearPath, clear("f9", keyB, convTopic)))

	require.Empty(t, h.delivery.targets())
}

func TestRejectsMalformedRequests(t *testing.T) {
	h := newHarness(t)
	welcome := "/xmtp/mls/1/w-" + convHex + "/proto"
	require.Equal(t, http.StatusBadRequest, h.post(ClearPath, clear("a1", keyA, welcome)))
	require.Equal(t, http.StatusBadRequest, h.post(ClearPath, clear("a1", keyA, "/stage/clear/"+convHex)))
	require.Equal(t, http.StatusBadRequest, h.post(ClearPath, clear("a1", "abc", convTopic)))
	require.Equal(t, http.StatusBadRequest, h.post(JoinPath, join("zz", keyA)))
	require.Equal(t, http.StatusBadRequest, h.post(JoinPath, `{"installationId":`))
	require.Equal(t, http.StatusBadRequest, h.post(JoinPath, `{"installationId":"a1","groupKey":"`+keyA+`","pad":"`+strings.Repeat("x", 5000)+`"}`))

	rec := httptest.NewRecorder()
	h.mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, ClearPath, nil))
	require.Equal(t, http.StatusMethodNotAllowed, rec.Code)
}

func TestRateLimitsEachGroup(t *testing.T) {
	h := newHarness(t)
	frozen := time.Unix(1_800_000_000, 0)
	h.service.now = func() time.Time { return frozen }
	for range 30 {
		require.Equal(t, http.StatusOK, h.post(ClearPath, clear("a1", keyA, convTopic)))
	}
	require.Equal(t, http.StatusTooManyRequests, h.post(ClearPath, clear("a1", keyA, convTopic)))
	require.Equal(t, http.StatusOK, h.post(ClearPath, clear("b1", keyB, convTopic)))

	frozen = frozen.Add(2 * time.Second)
	require.Equal(t, http.StatusOK, h.post(ClearPath, clear("a1", keyA, convTopic)))
}

func TestGlobalLimitCapsAllRequests(t *testing.T) {
	h := newHarness(t)
	frozen := time.Unix(1_800_000_000, 0)
	h.service.now = func() time.Time { return frozen }
	h.service.global = newLimiter(1, 2)
	require.Equal(t, http.StatusOK, h.post(JoinPath, join("a1", keyA)))
	require.Equal(t, http.StatusOK, h.post(JoinPath, join("b1", keyB)))
	require.Equal(t, http.StatusTooManyRequests, h.post(JoinPath, join("c1", keyA)))
}

func TestGroupOfHashesTheKey(t *testing.T) {
	require.Equal(t, "76c42c5e4568c097da8a830c21f9de43a5396dd4046916ccc1c95f63e5cab31e", GroupOf(keyA))
	require.NotEqual(t, GroupOf(keyA), GroupOf(keyB))
}
