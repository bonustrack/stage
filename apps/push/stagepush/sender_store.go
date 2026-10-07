package stagepush

import (
	"context"
	"database/sql"
	"time"

	"github.com/xmtp/example-notification-server-go/pkg/interfaces"
	topicutil "github.com/xmtp/example-notification-server-go/pkg/topics"
	"github.com/xmtp/xmtpd/pkg/topic"
	"go.uber.org/zap"
)

type SenderStore struct{ db *sql.DB }

func NewSenderStore(ctx context.Context, db *sql.DB) (*SenderStore, error) {
	_, err := db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS stage_sender_groups (group_hash TEXT PRIMARY KEY,last_seen TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS stage_sender_installations (
 installation_id TEXT PRIMARY KEY, group_hash TEXT NOT NULL, last_seen TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS stage_sender_installations_group ON stage_sender_installations(group_hash,last_seen);
CREATE TABLE IF NOT EXISTS stage_sender_keys (
 group_hash TEXT NOT NULL REFERENCES stage_sender_groups(group_hash), topic BYTEA NOT NULL,
 period INTEGER NOT NULL, key BYTEA NOT NULL CHECK (octet_length(key) = 42),
 PRIMARY KEY (group_hash, topic, period, key)
);
CREATE INDEX IF NOT EXISTS stage_sender_keys_period ON stage_sender_keys(period);
CREATE TABLE IF NOT EXISTS stage_sender_limits (
 singleton BOOLEAN PRIMARY KEY CHECK(singleton), group_count INTEGER NOT NULL,
 installation_count INTEGER NOT NULL, key_count INTEGER NOT NULL,
 window_id BIGINT NOT NULL, new_groups INTEGER NOT NULL, new_installations INTEGER NOT NULL
);
INSERT INTO stage_sender_limits SELECT TRUE,(SELECT count(*) FROM stage_sender_groups),
 (SELECT count(*) FROM stage_sender_installations),(SELECT count(*) FROM stage_sender_keys),0,0,0
 ON CONFLICT DO NOTHING;`)
	if err != nil {
		return nil, err
	}
	return &SenderStore{db: db}, nil
}

func (s *SenderStore) Publish(ctx context.Context, payload senderPayload, now time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	limits, err := lockSenderLimits(ctx, tx, now)
	if err != nil {
		return err
	}
	if err = enrollSender(ctx, tx, payload, now, limits); err != nil {
		return err
	}
	group := GroupOf(payload.GroupKey)
	result, err := tx.ExecContext(ctx, `DELETE FROM stage_sender_keys WHERE group_hash=$1 AND period<$2`, group, int(now.Unix()/periodSeconds)-1)
	if err != nil {
		return err
	}
	removed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	added, err := insertSenderKeys(ctx, tx, group, payload.Topics)
	if err != nil {
		return err
	}
	limits.keys += added - int(removed)
	var total int
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM stage_sender_keys WHERE group_hash=$1`, group).Scan(&total); err != nil {
		return err
	}
	if total > 50000 {
		return errSenderCapacity
	}
	if err = limits.save(ctx, tx); err != nil {
		return err
	}
	return tx.Commit()
}

func insertSenderKeys(ctx context.Context, tx *sql.Tx, group string, topics []senderTopic) (int, error) {
	if len(topics) == 0 {
		return 0, nil
	}
	names, keys, periods := [][]byte{}, [][]byte{}, []int32{}
	for _, sub := range topics {
		t, err := topicutil.ParseV3Topic(sub.Topic)
		if err != nil {
			return 0, err
		}
		for _, key := range sub.Keys {
			names = append(names, t.Bytes())
			keys = append(keys, key.Key)
			periods = append(periods, int32(key.Period))
		}
	}
	var added int
	err := tx.QueryRowContext(ctx, `WITH inserted AS (
 INSERT INTO stage_sender_keys(group_hash,topic,period,key)
 SELECT $1,topic,period,key FROM unnest($2::bytea[],$3::integer[],$4::bytea[]) AS batch(topic,period,key)
 ON CONFLICT DO NOTHING RETURNING 1) SELECT count(*) FROM inserted`, group, names, periods, keys).Scan(&added)
	if err != nil {
		return 0, err
	}
	var exceeded bool
	err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM stage_sender_keys WHERE group_hash=$1 GROUP BY topic,period HAVING count(*)>16)`, group).Scan(&exceeded)
	if err != nil {
		return 0, err
	}
	if exceeded {
		return 0, errSenderCapacity
	}
	return added, nil
}

func (s *SenderStore) PurgeExpired(ctx context.Context, now time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	limits, err := lockSenderLimits(ctx, tx, now)
	if err != nil {
		return err
	}
	if err = purgeSenderRows(ctx, tx, now, limits); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SenderStore) StartCleanup(ctx context.Context, logger *zap.Logger) {
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			cleanup, cancel := context.WithTimeout(ctx, 30*time.Second)
			if err := s.PurgeExpired(cleanup, time.Now()); err != nil && ctx.Err() == nil {
				logger.Warn("sender filter cleanup failed")
			}
			cancel()
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

type senderSubscriptions struct {
	interfaces.Subscriptions
	store *SenderStore
}

func WithSenderFilters(subscriptions interfaces.Subscriptions, store *SenderStore) interfaces.Subscriptions {
	return senderSubscriptions{Subscriptions: subscriptions, store: store}
}

func (s senderSubscriptions) GetSubscriptions(ctx context.Context, t *topic.Topic, period int) ([]interfaces.Subscription, error) {
	subs, err := s.Subscriptions.GetSubscriptions(ctx, t, period)
	if err != nil || len(subs) == 0 {
		return subs, err
	}
	ids := make([]string, len(subs))
	for i, sub := range subs {
		ids[i] = sub.InstallationId
	}
	keys, err := retrySenderRead(ctx, func(attempt context.Context) (map[string][][]byte, error) { return s.readKeys(attempt, ids, t, period) })
	if err != nil {
		return nil, err
	}
	for i := range subs {
		subs[i].SenderKeys = keys[subs[i].InstallationId]
	}
	return subs, nil
}

func (s senderSubscriptions) readKeys(ctx context.Context, ids []string, t *topic.Topic, period int) (map[string][][]byte, error) {
	rows, err := s.store.db.QueryContext(ctx, `
SELECT i.installation_id,k.key FROM stage_sender_installations i
JOIN stage_sender_keys k ON k.group_hash=i.group_hash
WHERE i.installation_id=ANY($1) AND k.topic=$2 AND k.period=$3`, ids, t.Bytes(), period)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string][][]byte{}
	for rows.Next() {
		var id string
		var key []byte
		if err := rows.Scan(&id, &key); err != nil {
			return nil, err
		}
		result[id] = append(result[id], key)
	}
	return result, rows.Err()
}

func retrySenderRead(ctx context.Context, read func(context.Context) (map[string][][]byte, error)) (map[string][][]byte, error) {
	delay := 100 * time.Millisecond
	for {
		attempt, cancel := context.WithTimeout(ctx, 5*time.Second)
		value, err := read(attempt)
		cancel()
		if err == nil {
			return value, nil
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, ctx.Err()
		case <-timer.C:
		}
		if delay < 5*time.Second {
			delay = min(delay*2, 5*time.Second)
		}
	}
}
