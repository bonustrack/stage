package stagepush

import (
	"math"
	"sync"
	"time"
)

const maxLimiterKeys = 10_000

type bucket struct {
	tokens float64
	at     time.Time
}

type limiter struct {
	mu      sync.Mutex
	rate    float64
	burst   float64
	buckets map[string]*bucket
}

func newLimiter(perSecond, burst float64) *limiter {
	return &limiter{rate: perSecond, burst: burst, buckets: map[string]*bucket{}}
}

func (l *limiter) level(b *bucket, now time.Time) float64 {
	return math.Min(l.burst, b.tokens+now.Sub(b.at).Seconds()*l.rate)
}

func (l *limiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	b, found := l.buckets[key]
	if !found {
		if len(l.buckets) >= maxLimiterKeys {
			for k, old := range l.buckets {
				if l.level(old, now) >= l.burst {
					delete(l.buckets, k)
				}
			}
			if len(l.buckets) >= maxLimiterKeys {
				return false
			}
		}
		b = &bucket{tokens: l.burst, at: now}
		l.buckets[key] = b
	}
	b.tokens = l.level(b, now)
	b.at = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}
