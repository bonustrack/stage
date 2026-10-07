package stagepush

import (
	"context"
	"database/sql"
	"time"
)

const (
	maxSenderGroups                  = 10000
	maxSenderInstallations           = 100000
	maxSenderKeys                    = 500000
	maxNewSenderGroupsPerHour        = 100
	maxNewSenderInstallationsPerHour = 500
)

type senderLimits struct {
	groups, installations, keys int
	window                      int64
	newGroups, newInstallations int
}

func lockSenderLimits(ctx context.Context, tx *sql.Tx, now time.Time) (*senderLimits, error) {
	var limits senderLimits
	err := tx.QueryRowContext(ctx, `SELECT group_count,installation_count,key_count,window_id,new_groups,new_installations FROM stage_sender_limits WHERE singleton=TRUE FOR UPDATE`).Scan(
		&limits.groups, &limits.installations, &limits.keys, &limits.window, &limits.newGroups, &limits.newInstallations)
	if err != nil {
		return nil, err
	}
	if window := now.Unix() / 3600; limits.window != window {
		limits.window, limits.newGroups, limits.newInstallations = window, 0, 0
	}
	return &limits, nil
}

func (l *senderLimits) save(ctx context.Context, tx *sql.Tx) error {
	if l.groups > maxSenderGroups || l.installations > maxSenderInstallations || l.keys > maxSenderKeys ||
		l.newGroups > maxNewSenderGroupsPerHour || l.newInstallations > maxNewSenderInstallationsPerHour {
		return errSenderCapacity
	}
	_, err := tx.ExecContext(ctx, `UPDATE stage_sender_limits SET group_count=$1,installation_count=$2,key_count=$3,window_id=$4,new_groups=$5,new_installations=$6 WHERE singleton=TRUE`,
		l.groups, l.installations, l.keys, l.window, l.newGroups, l.newInstallations)
	return err
}

func enrollSender(ctx context.Context, tx *sql.Tx, payload senderPayload, now time.Time, limits *senderLimits) error {
	group := GroupOf(payload.GroupKey)
	var bound string
	err := tx.QueryRowContext(ctx, `SELECT group_hash FROM stage_sender_installations WHERE installation_id=$1`, payload.InstallationID).Scan(&bound)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	known := err == nil
	if known && bound != group {
		return errSenderBinding
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO stage_sender_groups(group_hash,last_seen) VALUES($1,$2) ON CONFLICT DO NOTHING`, group, now)
	if err != nil {
		return err
	}
	added, err := result.RowsAffected()
	if err != nil {
		return err
	}
	limits.groups += int(added)
	if !known {
		limits.newGroups += int(added)
	}
	if _, err = tx.ExecContext(ctx, `UPDATE stage_sender_groups SET last_seen=$2 WHERE group_hash=$1`, group, now); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO stage_sender_installations(installation_id,group_hash,last_seen) VALUES($1,$2,$3)
 ON CONFLICT(installation_id) DO UPDATE SET last_seen=EXCLUDED.last_seen`, payload.InstallationID, group, now); err != nil {
		return err
	}
	if !known {
		limits.installations++
		limits.newInstallations++
	}
	var active int
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM stage_sender_installations WHERE group_hash=$1 AND last_seen>$2`, group, now.Add(-24*time.Hour)).Scan(&active); err != nil {
		return err
	}
	if active > maxGroupSize {
		return errSenderCapacity
	}
	return limits.save(ctx, tx)
}

func purgeSenderRows(ctx context.Context, tx *sql.Tx, now time.Time, limits *senderLimits) error {
	result, err := tx.ExecContext(ctx, `DELETE FROM stage_sender_keys WHERE period<$1`, int(now.Unix()/periodSeconds)-1)
	if err != nil {
		return err
	}
	removed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	limits.keys -= int(removed)
	result, err = tx.ExecContext(ctx, `DELETE FROM stage_sender_groups g WHERE last_seen<$1 AND NOT EXISTS(SELECT 1 FROM stage_sender_keys k WHERE k.group_hash=g.group_hash)`, now.Add(-24*time.Hour))
	if err != nil {
		return err
	}
	removed, err = result.RowsAffected()
	if err != nil {
		return err
	}
	limits.groups -= int(removed)
	return limits.save(ctx, tx)
}
