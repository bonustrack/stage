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
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	topicutil "github.com/xmtp/example-notification-server-go/pkg/topics"
	"github.com/xmtp/xmtpd/pkg/topic"
	"go.uber.org/zap"
)

const (
	SenderFilterPath       = "/stage.v1.Push/PublishSenderFilters"
	SenderVersionPath      = "/stage.v1.Push/SenderFilterVersion"
	senderSignatureDomain  = "stage.box sender filters v1\n"
	publicSignatureContext = "PUBLIC SIGNATURE CONTEXT"
	periodSeconds          = int64(30 * 24 * 60 * 60)
	maxSenderTopics        = 256
	maxSenderBodyBytes     = 256 << 10
)

var StageCommit = "unknown"
var errSenderBinding = errors.New("installation binding conflict")
var errSenderCapacity = errors.New("sender filter capacity reached")

type senderKey struct {
	Period int    `json:"thirtyDayPeriodsSinceEpoch"`
	Key    []byte `json:"key"`
}

type senderTopic struct {
	Topic string      `json:"topic"`
	Keys  []senderKey `json:"hmacKeys"`
}

type senderPayload struct {
	InstallationID string        `json:"installationId"`
	GroupKey       string        `json:"groupKey"`
	IssuedAt       int64         `json:"issuedAt"`
	Topics         []senderTopic `json:"topics"`
}

type signedSenderRequest struct {
	Payload   string `json:"payload"`
	Signature []byte `json:"signature"`
}

type senderWriter interface {
	Publish(context.Context, senderPayload, time.Time) error
}

type SenderHandler struct {
	store    senderWriter
	logger   *zap.Logger
	ingress  *limiter
	perGroup *limiter
	now      func() time.Time
}

func NewSenderHandler(store senderWriter, logger *zap.Logger) *SenderHandler {
	return &SenderHandler{store: store, logger: logger, ingress: newLimiter(10, 30), perGroup: newLimiter(2, 60), now: time.Now}
}

func (s *SenderHandler) Routes() map[string]http.Handler {
	return map[string]http.Handler{
		SenderFilterPath: s,
		SenderVersionPath: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			w.Header().Set("content-type", "application/json")
			w.Header().Set("cache-control", "no-store")
			_ = json.NewEncoder(w).Encode(map[string]string{"commit": StageCommit, "senderFilters": "1"})
		}),
	}
}

func decodeStrict(reader io.Reader, target any) error {
	decoder := json.NewDecoder(reader)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return errors.New("trailing json")
	}
	return nil
}

func verifySenderRequest(envelope signedSenderRequest, now time.Time) (senderPayload, error) {
	var payload senderPayload
	if err := decodeStrict(strings.NewReader(envelope.Payload), &payload); err != nil {
		return payload, errors.New("invalid payload")
	}
	publicKey, err := hex.DecodeString(payload.InstallationID)
	if err != nil || len(publicKey) != ed25519.PublicKeySize || payload.InstallationID != strings.ToLower(payload.InstallationID) {
		return payload, errors.New("invalid installation")
	}
	if !groupKeyPattern.MatchString(payload.GroupKey) || payload.IssuedAt < now.Unix()-300 || payload.IssuedAt > now.Unix()+30 {
		return payload, errors.New("invalid authorization")
	}
	digest := sha256.Sum256([]byte(envelope.Payload))
	prehash := sha512.Sum512([]byte(senderSignatureDomain + hex.EncodeToString(digest[:])))
	if err := ed25519.VerifyWithOptions(publicKey, prehash[:], envelope.Signature, &ed25519.Options{Hash: crypto.SHA512, Context: publicSignatureContext}); err != nil {
		return payload, errors.New("invalid signature")
	}
	return payload, validateSenderTopics(payload.Topics, int(payload.IssuedAt/periodSeconds))
}

func validateSenderTopics(topics []senderTopic, currentPeriod int) error {
	if len(topics) > maxSenderTopics {
		return errors.New("too many topics")
	}
	seen := map[string]bool{}
	for _, sub := range topics {
		t, err := topicutil.ParseV3Topic(sub.Topic)
		if err != nil || t.Kind() != topic.TopicKindGroupMessagesV1 || len(t.Identifier()) > 64 || seen[sub.Topic] || len(sub.Keys) == 0 || len(sub.Keys) > 3 {
			return errors.New("invalid topic")
		}
		seen[sub.Topic] = true
		for _, key := range sub.Keys {
			if len(key.Key) != 42 || key.Period < currentPeriod-1 || key.Period > currentPeriod+1 {
				return errors.New("invalid sender key")
			}
		}
	}
	return nil
}

func senderIngressKey(r *http.Request, envelope signedSenderRequest) string {
	address := r.Header.Get("Fly-Client-IP")
	if net.ParseIP(address) == nil {
		address, _, _ = net.SplitHostPort(r.RemoteAddr)
	}
	var claim struct {
		GroupKey string `json:"groupKey"`
	}
	_ = json.Unmarshal([]byte(envelope.Payload), &claim)
	if !groupKeyPattern.MatchString(claim.GroupKey) {
		return address
	}
	return address + ":" + GroupOf(claim.GroupKey)
}

func (s *SenderHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	controller := http.NewResponseController(w)
	_ = controller.SetReadDeadline(time.Now().Add(5 * time.Second))
	defer controller.SetReadDeadline(time.Time{})
	var envelope signedSenderRequest
	if err := decodeStrict(http.MaxBytesReader(w, r.Body, maxSenderBodyBytes), &envelope); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	now := s.now()
	if !s.ingress.allow(senderIngressKey(r, envelope), now) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
		return
	}
	payload, err := verifySenderRequest(envelope, now)
	if err != nil {
		http.Error(w, "invalid sender authorization", http.StatusUnauthorized)
		return
	}
	if !s.perGroup.allow(GroupOf(payload.GroupKey), now) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := s.store.Publish(ctx, payload, now); err != nil {
		switch {
		case errors.Is(err, errSenderBinding):
			http.Error(w, "installation binding conflict", http.StatusConflict)
		case errors.Is(err, errSenderCapacity):
			http.Error(w, "sender filter capacity reached", http.StatusTooManyRequests)
		default:
			s.logger.Error("sender filter storage failed")
			http.Error(w, "sender filter storage failed", http.StatusServiceUnavailable)
		}
		return
	}
	ok(w)
}
