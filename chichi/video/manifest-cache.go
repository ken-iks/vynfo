package video

import (
	"sync"
	"time"
)

type BranchID = string
type UserID = string
type ManifestKind = string

const (
	ManifestKindVideo ManifestKind = "video"
	ManifestKindAudio ManifestKind = "audio"
)

// A user editing a branch gets its own cache of the branch manifest for local edits
type EditSessions = map[BranchID]string
type ManifestCache struct {
	mu   sync.RWMutex
	core map[UserID]EditSessions
}

func InitateManifestCache() *ManifestCache {
	return &ManifestCache{core: map[UserID]EditSessions{}}
}

func manifestCacheKey(b BranchID, kind ManifestKind) BranchID {
	return b + ":" + kind
}

func (m *ManifestCache) Drop(u UserID, b BranchID, kind ManifestKind) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if inner, ok := m.core[u]; ok {
		delete(inner, manifestCacheKey(b, kind))
		if len(inner) == 0 {
			delete(m.core, u)
		}
	}
}

func (m *ManifestCache) DropBranch(u UserID, b BranchID) {
	m.Drop(u, b, ManifestKindVideo)
	m.Drop(u, b, ManifestKindAudio)
}

func (m *ManifestCache) Find(u UserID, b BranchID, kind ManifestKind) (string, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	v, ok := m.core[u][manifestCacheKey(b, kind)]
	return v, ok
}

func (m *ManifestCache) Add(
	u UserID,
	b BranchID,
	kind ManifestKind,
	manifest string,
	span time.Duration,
) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.core[u] == nil {
		m.core[u] = map[BranchID]string{}
	}
	m.core[u][manifestCacheKey(b, kind)] = manifest
	go func() {
		time.Sleep(span)
		m.Drop(u, b, kind)
	}()
}
