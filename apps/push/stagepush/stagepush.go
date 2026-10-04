package stagepush

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/xmtp/example-notification-server-go/pkg/interfaces"
	topicutil "github.com/xmtp/example-notification-server-go/pkg/topics"
	"github.com/xmtp/xmtpd/pkg/topic"
	"go.uber.org/zap"
)

const (
	JoinPath         = "/stage.v1.Push/JoinDeviceGroup"
	ClearPath        = "/stage.v1.Push/ClearConversation"
	ClearTopicPrefix = "/stage/clear/"

	maxBodyBytes = 4 << 10
	maxGroupSize = 50
	sendTimeout  = 10 * time.Second
)

var (
	groupKeyPattern       = regexp.MustCompile(`^[0-9a-f]{64}$`)
	installationIdPattern = regexp.MustCompile(`^[0-9a-fA-F]{1,128}$`)
)

type Groups interface {
	Join(ctx context.Context, installationId, group string) (bool, error)
	Members(ctx context.Context, group string, limit int) ([]string, error)
}

type Service struct {
	logger        *zap.Logger
	groups        Groups
	subscriptions interfaces.Subscriptions
	installations interfaces.Installations
	deliveries    []interfaces.Delivery
	global        *limiter
	perGroup      *limiter
	now           func() time.Time
}

func New(
	logger *zap.Logger,
	groups Groups,
	subscriptions interfaces.Subscriptions,
	installations interfaces.Installations,
	deliveries []interfaces.Delivery,
) *Service {
	return &Service{
		logger:        logger.Named("stagepush"),
		groups:        groups,
		subscriptions: subscriptions,
		installations: installations,
		deliveries:    deliveries,
		global:        newLimiter(50, 100),
		perGroup:      newLimiter(0.5, 30),
		now:           time.Now,
	}
}

func (s *Service) Routes() map[string]http.Handler {
	return map[string]http.Handler{
		JoinPath:  http.HandlerFunc(s.handleJoin),
		ClearPath: http.HandlerFunc(s.handleClear),
	}
}

type request struct {
	InstallationId string `json:"installationId"`
	GroupKey       string `json:"groupKey"`
	Topic          string `json:"topic"`
}

func GroupOf(groupKey string) string {
	raw, _ := hex.DecodeString(groupKey)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

func ClearTopic(t *topic.Topic) string {
	return ClearTopicPrefix + hex.EncodeToString(t.Identifier())
}

func (s *Service) admit(w http.ResponseWriter, r *http.Request, kind string) (*request, string, bool) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return nil, "", false
	}
	now := s.now()
	if !s.global.allow("", now) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
		return nil, "", false
	}
	req, err := decode(w, r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return nil, "", false
	}
	group := GroupOf(req.GroupKey)
	if !s.perGroup.allow(kind+group, now) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
		return nil, "", false
	}
	return req, group, true
}

func decode(w http.ResponseWriter, r *http.Request) (*request, error) {
	var req request
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&req); err != nil {
		return nil, errors.New("invalid json")
	}
	if !installationIdPattern.MatchString(req.InstallationId) {
		return nil, errors.New("invalid installationId")
	}
	if !groupKeyPattern.MatchString(req.GroupKey) {
		return nil, errors.New("invalid groupKey")
	}
	return &req, nil
}

func ok(w http.ResponseWriter) {
	w.Header().Set("content-type", "application/json")
	_, _ = w.Write([]byte("{}"))
}

func (s *Service) handleJoin(w http.ResponseWriter, r *http.Request) {
	req, group, admitted := s.admit(w, r, "join:")
	if !admitted {
		return
	}
	joined, err := s.groups.Join(r.Context(), req.InstallationId, group)
	if err != nil {
		s.logger.Error("join failed", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if !joined {
		http.Error(w, "installation belongs to another group", http.StatusConflict)
		return
	}
	ok(w)
}

func (s *Service) handleClear(w http.ResponseWriter, r *http.Request) {
	req, group, admitted := s.admit(w, r, "clear:")
	if !admitted {
		return
	}
	t, err := topicutil.ParseV3Topic(req.Topic)
	if err != nil || t.Kind() != topic.TopicKindGroupMessagesV1 {
		http.Error(w, "invalid topic", http.StatusBadRequest)
		return
	}
	if err := s.clear(r.Context(), req.InstallationId, group, t); err != nil {
		s.logger.Error("clear failed", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	ok(w)
}

func (s *Service) clear(ctx context.Context, requester, group string, t *topic.Topic) error {
	members, err := s.groups.Members(ctx, group, maxGroupSize)
	if err != nil {
		return err
	}
	inGroup := map[string]bool{}
	for _, id := range members {
		if id != requester {
			inGroup[id] = true
		}
	}
	if len(inGroup) == 0 {
		return nil
	}
	period := int(s.now().Unix() / 60 / 60 / 24 / 30)
	subs, err := s.subscriptions.GetSubscriptions(ctx, t, period)
	if err != nil {
		return err
	}
	var targets []string
	for _, sub := range subs {
		if inGroup[sub.InstallationId] {
			targets = append(targets, sub.InstallationId)
			delete(inGroup, sub.InstallationId)
		}
	}
	if len(targets) == 0 {
		return nil
	}
	installs, err := s.installations.GetInstallations(ctx, targets)
	if err != nil {
		return err
	}
	sendCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), sendTimeout)
	defer cancel()
	for _, inst := range installs {
		s.send(sendCtx, t, inst)
	}
	return nil
}

func (s *Service) send(ctx context.Context, t *topic.Topic, inst interfaces.Installation) {
	req := interfaces.SendRequest{
		IdempotencyKey: ClearTopic(t),
		Topic:          ClearTopic(t),
		PayloadFormat:  interfaces.NormalizePayloadFormat(inst.PayloadFormat),
		Installation:   inst,
		Subscription:   interfaces.Subscription{InstallationId: inst.Id, IsActive: true, IsSilent: true},
	}
	for _, delivery := range s.deliveries {
		if !delivery.CanDeliver(req) {
			continue
		}
		if err := delivery.Send(ctx, req); err != nil {
			s.logger.Warn("clear push failed", zap.String("kind", string(inst.DeliveryMechanism.Kind)), zap.Error(err))
		}
		return
	}
}

type postgresGroups struct {
	db *sql.DB
}

func NewPostgresGroups(ctx context.Context, db *sql.DB) (Groups, error) {
	_, err := db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS stage_device_groups (
    installation_id TEXT PRIMARY KEY,
    group_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stage_device_groups_group_hash_idx ON stage_device_groups (group_hash);`)
	if err != nil {
		return nil, err
	}
	return postgresGroups{db: db}, nil
}

func (g postgresGroups) Join(ctx context.Context, installationId, group string) (bool, error) {
	var stored string
	err := g.db.QueryRowContext(ctx, `
INSERT INTO stage_device_groups (installation_id, group_hash) VALUES ($1, $2)
ON CONFLICT (installation_id) DO UPDATE SET group_hash = stage_device_groups.group_hash
RETURNING group_hash`, installationId, group).Scan(&stored)
	if err != nil {
		return false, err
	}
	return stored == group, nil
}

func (g postgresGroups) Members(ctx context.Context, group string, limit int) ([]string, error) {
	rows, err := g.db.QueryContext(ctx, `
SELECT installation_id FROM stage_device_groups WHERE group_hash = $1 ORDER BY created_at DESC LIMIT $2`, group, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}
