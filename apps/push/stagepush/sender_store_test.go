package stagepush

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/xmtp/example-notification-server-go/pkg/testutils"
)

func senderTestDB(t *testing.T) (*SenderStore, *sql.DB) {
	t.Helper()
	if os.Getenv("STAGE_PUSH_DATABASE_TESTS") != "1" {
		t.Skip("isolated PostgreSQL required")
	}
	db := testutils.CreateTestDb(t)
	store, err := NewSenderStore(context.Background(), db)
	require.NoError(t, err)
	return store, db
}

func TestSenderReadRetriesTransientFailureAndStopsOnCancellation(t *testing.T) {
	attempts := 0
	keys, err := retrySenderRead(context.Background(), func(context.Context) (map[string][][]byte, error) {
		attempts++
		if attempts < 3 {
			return map[string][][]byte{"partial": {{1}}}, errors.New("unavailable")
		}
		return map[string][][]byte{"complete": {{2}}}, nil
	})
	require.NoError(t, err)
	require.Equal(t, 3, attempts)
	require.Equal(t, map[string][][]byte{"complete": {{2}}}, keys)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, err = retrySenderRead(ctx, func(context.Context) (map[string][][]byte, error) { return nil, errors.New("unavailable") })
	require.ErrorIs(t, err, context.DeadlineExceeded)
}

func TestSenderStoreCapacityRollsBackEnrollmentAndKeys(t *testing.T) {
	store, db := senderTestDB(t)
	ctx := context.Background()
	payload, _ := senderFixture(t)
	now := time.Unix(payload.IssuedAt, 0)
	for i := byte(0); i < 16; i++ {
		payload.Topics[0].Keys[0].Key = bytes.Repeat([]byte{i}, 42)
		require.NoError(t, store.Publish(ctx, payload, now))
	}
	payload.InstallationID = "uncommitted-synthetic-installation"
	payload.Topics[0].Keys[0].Key = bytes.Repeat([]byte{16}, 42)
	require.ErrorIs(t, store.Publish(ctx, payload, now), errSenderCapacity)
	var rows int
	require.NoError(t, db.QueryRow(`SELECT count(*) FROM stage_sender_installations`).Scan(&rows))
	require.Equal(t, 1, rows)
	require.NoError(t, db.QueryRow(`SELECT count(*) FROM stage_sender_keys`).Scan(&rows))
	require.Equal(t, 16, rows)
	payload.Topics[0].Keys[0].Key = bytes.Repeat([]byte{0}, 42)
	require.NoError(t, store.Publish(ctx, payload, now))
	require.NoError(t, db.QueryRow(`SELECT count(*) FROM stage_sender_keys`).Scan(&rows))
	require.Equal(t, 16, rows)
}

func TestSenderStoreFailureDoesNotLeavePartialEnrollment(t *testing.T) {
	store, db := senderTestDB(t)
	payload, _ := senderFixture(t)
	_, err := db.Exec(`ALTER TABLE stage_sender_keys ADD CONSTRAINT synthetic_failure CHECK (period < 0)`)
	require.NoError(t, err)
	require.Error(t, store.Publish(context.Background(), payload, time.Unix(payload.IssuedAt, 0)))
	for _, table := range []string{"stage_sender_groups", "stage_sender_installations", "stage_sender_keys"} {
		var rows int
		require.NoError(t, db.QueryRow(`SELECT count(*) FROM `+table).Scan(&rows))
		require.Zero(t, rows)
	}
}

func TestSenderStoreReplayDoesNotExtendPeriodRetention(t *testing.T) {
	store, db := senderTestDB(t)
	ctx := context.Background()
	payload, _ := senderFixture(t)
	now := time.Unix(payload.IssuedAt, 0)
	period := payload.Topics[0].Keys[0].Period
	require.NoError(t, store.Publish(ctx, payload, now))
	require.NoError(t, store.Publish(ctx, payload, now.Add(299*time.Second)))
	payload.Topics[0].Keys[0].Period = period + 1
	require.NoError(t, store.Publish(ctx, payload, now))
	require.NoError(t, store.PurgeExpired(ctx, time.Unix(int64(period+2)*periodSeconds, 0)))
	var count, retainedPeriod int
	require.NoError(t, db.QueryRow(`SELECT count(*),min(period) FROM stage_sender_keys`).Scan(&count, &retainedPeriod))
	require.Equal(t, 1, count)
	require.Equal(t, period+1, retainedPeriod)
	require.NoError(t, store.PurgeExpired(ctx, time.Unix(int64(period+3)*periodSeconds, 0)))
	require.NoError(t, db.QueryRow(`SELECT count(*) FROM stage_sender_keys`).Scan(&count))
	require.Zero(t, count)
}
