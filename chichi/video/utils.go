package video

import (
	"cloud.google.com/go/storage"
	"fmt"
	"log/slog"
	"strings"
	"time"
)

// Signs all of the URLs within a historical manifest until the expiry time
func SignManifest(bucket *storage.BucketHandle, manifest string, expiry time.Time) (string, error) {
	var result strings.Builder
	for i, line := range strings.Split(manifest, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			result.WriteString(fmt.Sprintf("%s\n", line))
			continue
		}
		url, err := bucket.SignedURL(trimmed, &storage.SignedURLOptions{
			Method:  "GET",
			Expires: expiry,
		})
		if err != nil {
			slog.Error("signManifest failed", "lineIdx", i, "object", trimmed, "error", err)
			return "", fmt.Errorf("signing %s: %w", trimmed, err)
		}
		slog.Debug("signManifest signed segment", "lineIdx", i, "object", trimmed)
		result.WriteString(fmt.Sprintf("%s\n", url))
	}
	return result.String(), nil
}
