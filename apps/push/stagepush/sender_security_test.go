package stagepush

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type senderClockReader struct {
	*strings.Reader
	advance func()
}

func (r *senderClockReader) Read(p []byte) (int, error) {
	if r.advance != nil {
		r.advance()
		r.advance = nil
	}
	return r.Reader.Read(p)
}

type senderDeadlineRecorder struct {
	*httptest.ResponseRecorder
	deadlines []time.Time
}

func (w *senderDeadlineRecorder) SetReadDeadline(t time.Time) error {
	w.deadlines = append(w.deadlines, t)
	return nil
}

func TestSenderUsesTimeAfterReadingBoundedBody(t *testing.T) {
	payload, key := senderFixture(t)
	now := time.Unix(payload.IssuedAt, 0)
	store := &senderRecorder{}
	handler := NewSenderHandler(store, zap.NewNop())
	handler.now = func() time.Time { return now }
	reader := &senderClockReader{Reader: strings.NewReader(signSenderFixture(t, payload, key)), advance: func() { now = now.Add(301 * time.Second) }}
	writer := &senderDeadlineRecorder{ResponseRecorder: httptest.NewRecorder()}
	handler.ServeHTTP(writer, httptest.NewRequest(http.MethodPost, SenderFilterPath, reader))
	require.Equal(t, http.StatusUnauthorized, writer.Code)
	require.Zero(t, store.calls)
	require.Len(t, writer.deadlines, 2)
	require.False(t, writer.deadlines[0].IsZero())
	require.True(t, writer.deadlines[1].IsZero())
}

func TestSenderInvalidTrafficDoesNotConsumeOtherCapabilitiesBudget(t *testing.T) {
	payload, key := senderFixture(t)
	store := &senderRecorder{}
	handler := NewSenderHandler(store, zap.NewNop())
	handler.now = func() time.Time { return time.Unix(payload.IssuedAt, 0) }
	for i := 0; i < 200; i++ {
		writer := httptest.NewRecorder()
		handler.ServeHTTP(writer, httptest.NewRequest(http.MethodPost, SenderFilterPath, strings.NewReader(`{"payload":"{}","signature":""}`)))
		require.Contains(t, []int{http.StatusUnauthorized, http.StatusTooManyRequests}, writer.Code)
	}
	writer := httptest.NewRecorder()
	handler.ServeHTTP(writer, httptest.NewRequest(http.MethodPost, SenderFilterPath, strings.NewReader(signSenderFixture(t, payload, key))))
	require.Equal(t, http.StatusOK, writer.Code)
	require.Equal(t, 1, store.calls)
}

func TestSenderPeriodBoundaryAllowsAcceptedClockSkew(t *testing.T) {
	payload, key := senderFixture(t)
	boundary := int64(700) * periodSeconds
	for _, skew := range []int64{-299, 29} {
		payload.IssuedAt = boundary + skew
		period := int(payload.IssuedAt / periodSeconds)
		payload.Topics[0].Keys = []senderKey{{Period: period - 1, Key: make([]byte, 42)}, {Period: period, Key: make([]byte, 42)}, {Period: period + 1, Key: make([]byte, 42)}}
		var envelope signedSenderRequest
		require.NoError(t, json.Unmarshal([]byte(signSenderFixture(t, payload, key)), &envelope))
		_, err := verifySenderRequest(envelope, time.Unix(boundary, 0))
		require.NoError(t, err)
	}
}

func TestSenderLimiterMemoryIsBounded(t *testing.T) {
	limiter := newLimiter(1, 2)
	now := time.Unix(1800000000, 0)
	for i := 0; i < maxLimiterKeys; i++ {
		require.True(t, limiter.allow(fmt.Sprint(i), now))
	}
	require.False(t, limiter.allow("overflow", now))
	require.Len(t, limiter.buckets, maxLimiterKeys)
	require.True(t, limiter.allow("0", now))
	require.True(t, limiter.allow("replacement", now.Add(2*time.Second)))
	require.LessOrEqual(t, len(limiter.buckets), maxLimiterKeys)
}
