package stagepush

import (
	"context"
	"crypto"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zaptest/observer"
)

type senderRecorder struct {
	calls   int
	fail    bool
	payload senderPayload
}

func (r *senderRecorder) Publish(_ context.Context, p senderPayload, _ time.Time) error {
	r.calls++
	r.payload = p
	if r.fail {
		return errors.New("database failure containing secret fixture")
	}
	return nil
}

func senderFixture(t *testing.T) (senderPayload, ed25519.PrivateKey) {
	t.Helper()
	key := ed25519.NewKeyFromSeed(make([]byte, 32))
	return senderPayload{
		InstallationID: hex.EncodeToString(key.Public().(ed25519.PublicKey)), GroupKey: keyA,
		IssuedAt: 1_800_000_000,
		Topics:   []senderTopic{{Topic: convTopic, Keys: []senderKey{{Period: int(1_800_000_000 / periodSeconds), Key: make([]byte, 42)}}}},
	}, key
}

func signSenderFixture(t *testing.T, payload senderPayload, key ed25519.PrivateKey) string {
	t.Helper()
	raw, err := json.Marshal(payload)
	require.NoError(t, err)
	digest := sha256.Sum256(raw)
	prehash := sha512.Sum512([]byte(senderSignatureDomain + hex.EncodeToString(digest[:])))
	sig, err := key.Sign(nil, prehash[:], &ed25519.Options{Hash: crypto.SHA512, Context: publicSignatureContext})
	require.NoError(t, err)
	body, err := json.Marshal(signedSenderRequest{Payload: string(raw), Signature: sig})
	require.NoError(t, err)
	return string(body)
}

func TestSenderAuthenticationAndPrivacyBoundary(t *testing.T) {
	payload, key := senderFixture(t)
	store := &senderRecorder{}
	logs, observed := observer.New(zap.DebugLevel)
	handler := NewSenderHandler(store, zap.New(logs))
	handler.now = func() time.Time { return time.Unix(payload.IssuedAt, 0) }
	post := func(body string) int {
		r := httptest.NewRecorder()
		handler.ServeHTTP(r, httptest.NewRequest(http.MethodPost, SenderFilterPath, strings.NewReader(body)))
		return r.Code
	}
	require.Equal(t, http.StatusOK, post(signSenderFixture(t, payload, key)))
	require.Equal(t, 1, store.calls)
	for _, mutate := range []func(*senderPayload){
		func(p *senderPayload) { p.InstallationID = strings.Repeat("a", 64) },
		func(p *senderPayload) { p.IssuedAt -= 301 },
		func(p *senderPayload) { p.IssuedAt += 31 },
		func(p *senderPayload) { p.GroupKey = "not-a-capability" },
		func(p *senderPayload) {
			p.Topics = []senderTopic{{Topic: "/xmtp/mls/1/w-abcd/proto", Keys: payload.Topics[0].Keys}}
		},
		func(p *senderPayload) {
			p.Topics = []senderTopic{{Topic: convTopic, Keys: []senderKey{{Period: 0, Key: make([]byte, 42)}}}}
		},
		func(p *senderPayload) {
			p.Topics = []senderTopic{{Topic: convTopic, Keys: []senderKey{{Period: payload.Topics[0].Keys[0].Period, Key: make([]byte, 32)}}}}
		},
	} {
		bad := payload
		mutate(&bad)
		require.Equal(t, http.StatusUnauthorized, post(signSenderFixture(t, bad, key)))
	}
	valid := signSenderFixture(t, payload, key)
	require.Equal(t, http.StatusUnauthorized, post(strings.Replace(valid, keyA, keyB, 1)))
	require.Equal(t, http.StatusBadRequest, post(strings.TrimSuffix(valid, "}")+`,"plaintext":"must never be accepted"}`))
	require.Equal(t, http.StatusBadRequest, post(valid+` {}`))
	require.Equal(t, 1, store.calls)
	store.fail = true
	require.Equal(t, http.StatusServiceUnavailable, post(valid))
	require.Equal(t, 1, observed.Len())
	require.Equal(t, "sender filter storage failed", observed.All()[0].Message)
	require.Empty(t, observed.All()[0].Context)
}

func TestSenderRejectsContentFieldsInsideSignedPayload(t *testing.T) {
	payload, key := senderFixture(t)
	var envelope signedSenderRequest
	require.NoError(t, json.Unmarshal([]byte(signSenderFixture(t, payload, key)), &envelope))
	envelope.Payload = strings.TrimSuffix(envelope.Payload, "}") + `,"message":"never sent to the server"}`
	_, err := verifySenderRequest(envelope, time.Unix(payload.IssuedAt, 0))
	require.Error(t, err)
}

func TestSenderAcceptsXmtpWasmVerifiedWireFixture(t *testing.T) {
	raw, err := os.ReadFile("testdata/sender-filter.json")
	require.NoError(t, err)
	var envelope signedSenderRequest
	require.NoError(t, json.Unmarshal(raw, &envelope))
	payload, err := verifySenderRequest(envelope, time.Unix(1_800_000_000, 0))
	require.NoError(t, err)
	require.Equal(t, strings.Repeat("b", 64), payload.GroupKey)
	require.Equal(t, "3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29", payload.InstallationID)
	require.Len(t, payload.Topics, 1)
	require.Equal(t, 694, payload.Topics[0].Keys[0].Period)
}

func TestSenderSignatureIsDomainSeparated(t *testing.T) {
	payload, key := senderFixture(t)
	var envelope signedSenderRequest
	require.NoError(t, json.Unmarshal([]byte(signSenderFixture(t, payload, key)), &envelope))
	envelope.Signature = ed25519.Sign(key, []byte(envelope.Payload))
	_, err := verifySenderRequest(envelope, time.Unix(payload.IssuedAt, 0))
	require.Error(t, err)
}
