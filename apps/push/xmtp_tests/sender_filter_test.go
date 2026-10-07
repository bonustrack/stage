package xmtp

import (
	"bytes"
	"context"
	"crypto"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/xmtp/example-notification-server-go/pkg/installations"
	"github.com/xmtp/example-notification-server-go/pkg/interfaces"
	"github.com/xmtp/example-notification-server-go/pkg/stagepush"
	"github.com/xmtp/example-notification-server-go/pkg/subscriptions"
	"github.com/xmtp/example-notification-server-go/pkg/testutils"
	topicutil "github.com/xmtp/example-notification-server-go/pkg/topics"
	"go.uber.org/zap"
)

func stageContext(key []byte) interfaces.MessageContext {
	ciphertext := []byte("synthetic opaque MLS ciphertext, not a user message")
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(ciphertext)
	signature := mac.Sum(nil)
	push := true
	return interfaces.MessageContext{ShouldPush: &push, HmacInputs: &ciphertext, SenderHmac: &signature}
}

func TestStageAdditionalSenderKeys(t *testing.T) {
	own := bytes.Repeat([]byte{1}, 42)
	other := bytes.Repeat([]byte{2}, 42)
	d := &deliveryDispatcher{}
	sub := interfaces.Subscription{SenderKeys: [][]byte{own}}
	require.False(t, d.shouldDeliver(stageContext(own), sub))
	require.True(t, d.shouldDeliver(stageContext(other), sub))
	raw, err := json.Marshal(sub)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "SenderKeys")
	require.NotContains(t, string(raw), "key")
}

func TestStageSenderDB(t *testing.T) {
	if os.Getenv("STAGE_PUSH_DATABASE_TESTS") != "1" {
		t.Skip("isolated PostgreSQL required")
	}
	db := testutils.CreateTestDb(t)
	ctx := context.Background()
	logger := zap.NewNop()
	store, err := stagepush.NewSenderStore(ctx, db)
	require.NoError(t, err)
	base := subscriptions.NewSubscriptionsService(logger, db)
	filtered := stagepush.WithSenderFilters(base, store)
	installs := installations.NewInstallationsService(logger, db)
	handler := stagepush.NewSenderHandler(store, logger)
	groupA, groupB := strings.Repeat("a", 64), strings.Repeat("b", 64)
	oldKey, newKey, otherKey := bytes.Repeat([]byte{1}, 42), bytes.Repeat([]byte{2}, 42), bytes.Repeat([]byte{3}, 42)
	period := int(time.Now().Unix() / (30 * 24 * 60 * 60))
	phone := ed25519.NewKeyFromSeed(bytes.Repeat([]byte{11}, 32))
	laptop := ed25519.NewKeyFromSeed(bytes.Repeat([]byte{12}, 32))
	other := ed25519.NewKeyFromSeed(bytes.Repeat([]byte{13}, 32))
	legacy := ed25519.NewKeyFromSeed(bytes.Repeat([]byte{14}, 32))
	id := func(key ed25519.PrivateKey) string { return hex.EncodeToString(key.Public().(ed25519.PublicKey)) }
	topics := []string{"/xmtp/mls/1/g-0123456789abcdef0123456789abcdef/proto", "/xmtp/mls/1/g-abcdef0123456789abcdef0123456789/proto"}
	for _, key := range []ed25519.PrivateKey{phone, other, legacy} {
		_, err = installs.Register(ctx, interfaces.Installation{Id: id(key), DeliveryMechanism: interfaces.DeliveryMechanism{Kind: interfaces.FCM, Token: "synthetic-only"}})
		require.NoError(t, err)
		for _, name := range topics {
			topic, err := topicutil.ParseV3Topic(name)
			require.NoError(t, err)
			err = base.SubscribeWithMetadata(ctx, id(key), []interfaces.SubscriptionInput{{Topic: topic, HmacKeys: []interfaces.HmacKey{{ThirtyDayPeriodsSinceEpoch: period, Key: oldKey}}}})
			require.NoError(t, err)
		}
	}
	post := func(key ed25519.PrivateKey, group string, senderKey []byte, issuedAt int64) int {
		body := stageSignedBody(key, group, topics, senderKey, period, issuedAt)
		r := httptest.NewRecorder()
		handler.ServeHTTP(r, httptest.NewRequest(http.MethodPost, stagepush.SenderFilterPath, strings.NewReader(body)))
		return r.Code
	}
	require.Equal(t, http.StatusOK, post(phone, groupA, oldKey, time.Now().Unix()))
	require.Equal(t, http.StatusOK, post(other, groupB, otherKey, time.Now().Unix()))
	require.Equal(t, http.StatusOK, post(laptop, groupA, newKey, time.Now().Unix()))
	var tokenCount int
	require.NoError(t, db.QueryRow(`SELECT count(*) FROM installations WHERE id=$1`, id(laptop)).Scan(&tokenCount))
	require.Zero(t, tokenCount)
	require.Equal(t, http.StatusConflict, post(laptop, groupB, newKey, time.Now().Unix()))
	require.Equal(t, http.StatusUnauthorized, post(laptop, groupA, otherKey, time.Now().Unix()-301))
	require.Equal(t, http.StatusOK, post(laptop, groupA, oldKey, time.Now().Unix()))
	var wg sync.WaitGroup
	codes := make(chan int, 8)
	for i := byte(4); i < 12; i++ {
		wg.Add(1)
		go func(value byte) {
			defer wg.Done()
			codes <- post(laptop, groupA, bytes.Repeat([]byte{value}, 42), time.Now().Unix())
		}(i)
	}
	wg.Wait()
	close(codes)
	for code := range codes {
		require.Equal(t, http.StatusOK, code)
	}
	for _, name := range topics {
		topic, err := topicutil.ParseV3Topic(name)
		require.NoError(t, err)
		before, err := base.GetSubscriptions(ctx, topic, period)
		require.NoError(t, err)
		after, err := filtered.GetSubscriptions(ctx, topic, period)
		require.NoError(t, err)
		require.Len(t, after, len(before))
		for _, sub := range after {
			require.True(t, sub.IsActive)
			require.Equal(t, oldKey, sub.HmacKey.Key)
			d := &deliveryDispatcher{}
			switch sub.InstallationId {
			case id(phone):
				require.False(t, d.shouldDeliver(stageContext(newKey), sub))
				require.True(t, d.shouldDeliver(stageContext(otherKey), sub))
				for i := byte(4); i < 12; i++ {
					require.False(t, d.shouldDeliver(stageContext(bytes.Repeat([]byte{i}, 42)), sub))
				}
			case id(other):
				require.True(t, d.shouldDeliver(stageContext(newKey), sub))
				require.False(t, d.shouldDeliver(stageContext(otherKey), sub))
			case id(legacy):
				require.Empty(t, sub.SenderKeys)
				require.True(t, d.shouldDeliver(stageContext(newKey), sub))
			default:
				t.Fatal("unexpected subscription created")
			}
		}
	}
	stagePreservesLegacyAndMuteState(t, db, filtered, id(legacy), groupA, topics[0], period)
	stageRecoversSupplementalRead(t, db, filtered, topics[0], period)
}

func stageRecoversSupplementalRead(t *testing.T, db *sql.DB, filtered interfaces.Subscriptions, name string, period int) {
	t.Helper()
	topic, err := topicutil.ParseV3Topic(name)
	require.NoError(t, err)
	_, err = db.Exec(`ALTER TABLE stage_sender_keys RENAME TO temporarily_unavailable`)
	require.NoError(t, err)
	restored := make(chan error, 1)
	go func() {
		time.Sleep(50 * time.Millisecond)
		_, err := db.Exec(`ALTER TABLE temporarily_unavailable RENAME TO stage_sender_keys`)
		restored <- err
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	subs, err := filtered.GetSubscriptions(ctx, topic, period)
	require.NoError(t, <-restored)
	require.NoError(t, err)
	require.Len(t, subs, 2)
	for _, sub := range subs {
		require.NotEmpty(t, sub.SenderKeys)
	}
}

func stagePreservesLegacyAndMuteState(t *testing.T, db *sql.DB, filtered interfaces.Subscriptions, legacy, group, name string, period int) {
	t.Helper()
	ctx := context.Background()
	groups, err := stagepush.NewPostgresGroups(ctx, db)
	require.NoError(t, err)
	joined, err := groups.Join(ctx, legacy, stagepush.GroupOf(group))
	require.NoError(t, err)
	require.True(t, joined)
	topic, err := topicutil.ParseV3Topic(name)
	require.NoError(t, err)
	subs, err := filtered.GetSubscriptions(ctx, topic, period)
	require.NoError(t, err)
	for _, sub := range subs {
		if sub.InstallationId == legacy {
			require.Empty(t, sub.SenderKeys)
		}
	}
	_, err = db.Exec(`UPDATE subscriptions SET is_silent=TRUE`)
	require.NoError(t, err)
	_, err = db.Exec(`UPDATE subscriptions SET is_active=FALSE WHERE installation_id=$1`, legacy)
	require.NoError(t, err)
	subs, err = filtered.GetSubscriptions(ctx, topic, period)
	require.NoError(t, err)
	require.Len(t, subs, 2)
	for _, sub := range subs {
		require.NotEqual(t, legacy, sub.InstallationId)
		require.True(t, sub.IsSilent)
	}
}

func stageSignedBody(key ed25519.PrivateKey, group string, topics []string, senderKey []byte, period int, issuedAt int64) string {
	values := make([]map[string]any, len(topics))
	for i, name := range topics {
		values[i] = map[string]any{"topic": name, "hmacKeys": []map[string]any{{"thirtyDayPeriodsSinceEpoch": period, "key": senderKey}}}
	}
	payload, _ := json.Marshal(map[string]any{"installationId": hex.EncodeToString(key.Public().(ed25519.PublicKey)), "groupKey": group, "issuedAt": issuedAt, "topics": values})
	digest := sha256.Sum256(payload)
	prehash := sha512.Sum512([]byte("stage.box sender filters v1\n" + hex.EncodeToString(digest[:])))
	signature, err := key.Sign(nil, prehash[:], &ed25519.Options{Hash: crypto.SHA512, Context: "PUBLIC SIGNATURE CONTEXT"})
	if err != nil {
		panic(err)
	}
	body, _ := json.Marshal(map[string]any{"payload": string(payload), "signature": signature})
	return string(body)
}
