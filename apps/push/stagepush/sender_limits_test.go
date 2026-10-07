package stagepush

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func assertSenderCounts(t *testing.T, db *sql.DB, groups, installations, keys int) {
	t.Helper()
	var actualGroups, actualInstallations, actualKeys int
	require.NoError(t, db.QueryRow(`SELECT group_count,installation_count,key_count FROM stage_sender_limits`).Scan(&actualGroups, &actualInstallations, &actualKeys))
	require.Equal(t, []int{groups, installations, keys}, []int{actualGroups, actualInstallations, actualKeys})
	require.NoError(t, db.QueryRow(`SELECT (SELECT count(*) FROM stage_sender_groups),(SELECT count(*) FROM stage_sender_installations),(SELECT count(*) FROM stage_sender_keys)`).Scan(&actualGroups, &actualInstallations, &actualKeys))
	require.Equal(t, []int{groups, installations, keys}, []int{actualGroups, actualInstallations, actualKeys})
}

func TestSenderGlobalLimitsRollbackAndPreserveKnownPublications(t *testing.T) {
	for _, check := range []struct {
		column string
		limit  int
		kind   string
	}{
		{"group_count", maxSenderGroups, "group"},
		{"installation_count", maxSenderInstallations, "installation"},
		{"key_count", maxSenderKeys, "key"},
		{"new_groups", maxNewSenderGroupsPerHour, "group"},
		{"new_installations", maxNewSenderInstallationsPerHour, "installation"},
	} {
		t.Run(check.column, func(t *testing.T) {
			store, db := senderTestDB(t)
			ctx := context.Background()
			payload, _ := senderFixture(t)
			now := time.Unix(payload.IssuedAt, 0)
			require.NoError(t, store.Publish(ctx, payload, now))
			assertSenderCounts(t, db, 1, 1, 1)
			_, err := db.Exec(`UPDATE stage_sender_limits SET `+check.column+`=$1`, check.limit)
			require.NoError(t, err)
			extra := payload
			switch check.kind {
			case "group":
				extra.InstallationID = "new"
				extra.GroupKey = keyB
			case "installation":
				extra.InstallationID = "new"
			case "key":
				extra.Topics = []senderTopic{{Topic: convTopic, Keys: []senderKey{{Period: payload.Topics[0].Keys[0].Period, Key: bytes.Repeat([]byte{9}, 42)}}}}
			}
			require.ErrorIs(t, store.Publish(ctx, extra, now), errSenderCapacity)
			require.NoError(t, store.Publish(ctx, payload, now))
			var count int
			require.NoError(t, db.QueryRow(`SELECT `+check.column+` FROM stage_sender_limits`).Scan(&count))
			require.Equal(t, check.limit, count)
			for _, table := range []string{"stage_sender_groups", "stage_sender_installations", "stage_sender_keys"} {
				require.NoError(t, db.QueryRow(`SELECT count(*) FROM `+table).Scan(&count))
				require.Equal(t, 1, count)
			}
		})
	}
}

func TestSenderActiveLimitRecoversWithoutRemovingImmutableBindings(t *testing.T) {
	store, db := senderTestDB(t)
	ctx := context.Background()
	payload, _ := senderFixture(t)
	payload.Topics = nil
	now := time.Unix(payload.IssuedAt, 0)
	for i := 0; i < maxGroupSize; i++ {
		payload.InstallationID = fmt.Sprint(i)
		require.NoError(t, store.Publish(ctx, payload, now))
	}
	payload.InstallationID = "new"
	require.ErrorIs(t, store.Publish(ctx, payload, now), errSenderCapacity)
	assertSenderCounts(t, db, 1, maxGroupSize, 0)
	require.NoError(t, store.Publish(ctx, payload, now.Add(25*time.Hour)))
	assertSenderCounts(t, db, 1, maxGroupSize+1, 0)
	later := now.Add(50 * time.Hour)
	require.NoError(t, store.PurgeExpired(ctx, later))
	assertSenderCounts(t, db, 0, maxGroupSize+1, 0)
	payload.GroupKey = keyB
	require.ErrorIs(t, store.Publish(ctx, payload, later), errSenderBinding)
	assertSenderCounts(t, db, 0, maxGroupSize+1, 0)
	payload.GroupKey = keyA
	require.NoError(t, store.Publish(ctx, payload, later))
	assertSenderCounts(t, db, 1, maxGroupSize+1, 0)
}

func TestSenderMaximumBatchIsAtomicAndIdempotent(t *testing.T) {
	store, db := senderTestDB(t)
	payload, _ := senderFixture(t)
	now := time.Unix(payload.IssuedAt, 0)
	period := payload.Topics[0].Keys[0].Period
	payload.Topics = make([]senderTopic, maxSenderTopics)
	for i := range payload.Topics {
		payload.Topics[i] = senderTopic{Topic: fmt.Sprintf("/xmtp/mls/1/g-%032x/proto", i)}
		for p := period - 1; p <= period+1; p++ {
			payload.Topics[i].Keys = append(payload.Topics[i].Keys, senderKey{Period: p, Key: bytes.Repeat([]byte{1}, 42)})
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, store.Publish(ctx, payload, now))
	require.NoError(t, store.Publish(ctx, payload, now))
	assertSenderCounts(t, db, 1, 1, maxSenderTopics*3)
	require.NoError(t, store.PurgeExpired(ctx, time.Unix(int64(period+3)*periodSeconds, 0)))
	assertSenderCounts(t, db, 0, 1, 0)
}
