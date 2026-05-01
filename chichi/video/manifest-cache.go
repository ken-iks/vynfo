package video

import (
	"sync"
	"time"
)

type BranchID = string
type UserID = string

// A user editing a branch gets its own cache of the branch manifest for local edits
type EditSessions = map[BranchID]string
type ManifestCache struct {
	mu   sync.RWMutex
	core map[UserID]EditSessions
}

func InitateManifestCache() *ManifestCache {
	return &ManifestCache{core: map[UserID]EditSessions{}}
}

func (m *ManifestCache) Drop(u UserID, b BranchID) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if inner, ok := m.core[u]; ok {
		delete(inner, b)
		if len(inner) == 0 {
			delete(m.core, u)
		}
	}
}

func (m *ManifestCache) Find(u UserID, b BranchID) (string, bool) {
	v, ok := m.core[u][b]
	return v, ok
}

func (m *ManifestCache) Add(u UserID, b BranchID, manifest string, span time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.core[u] == nil {
		m.core[u] = map[BranchID]string{}
	}
	m.core[u][b] = manifest
	go func() {
		time.Sleep(span)
		m.Drop(u, b)
	}()
}
