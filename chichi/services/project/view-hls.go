package project

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"cloud.google.com/go/storage"
)

// GetManifest handles GET /video?videoId=abc or GET /video?branchId=abc
// HLS protocal doesn't support endpoints over connect RPC - so we expose this endpoint
// over pure https. Raw video manifests are keyed by video id; branch playback manifests
// are keyed by branch id — both live under manifests/<id>.m3u8.
func (p *ProjectServiceServer) GetManifest(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	branchId := r.URL.Query().Get("branchId")
	videoId := r.URL.Query().Get("videoId")
	manifestId := branchId
	kind := "branch"
	if manifestId == "" {
		manifestId = videoId
		kind = "video"
	}
	if manifestId == "" {
		slog.Warn("GetManifest missing id", "branchId", branchId, "videoId", videoId)
		http.Error(w, "missing branchId or videoId", http.StatusBadRequest)
		return
	}
	slog.Info("GetManifest request", "kind", kind, "manifestId", manifestId)

	bucket := p.storageClient.Bucket("vedit-v1")
	path := fmt.Sprintf("manifests/%s.m3u8", manifestId)
	reader, err := bucket.Object(path).NewReader(ctx)
	if err != nil {
		slog.Error("GetManifest failed to open manifest", "path", path, "error", err)
		http.Error(w, "invalid manifest id", http.StatusBadRequest)
		return
	}
	defer reader.Close()
	raw, err := io.ReadAll(reader)
	if err != nil {
		slog.Error("GetManifest failed to read manifest", "path", path, "error", err)
		http.Error(w, "failed to read manifest", http.StatusInternalServerError)
		return
	}
	slog.Debug("GetManifest raw manifest", "path", path, "body", string(raw))
	signed, err := signManifest(bucket, string(raw))
	if err != nil {
		slog.Error("GetManifest failed to sign manifest", "path", path, "error", err)
		http.Error(w, "failed to sign manifest", http.StatusInternalServerError)
		return
	}
	slog.Debug("successfully signed manifest")
	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	io.WriteString(w, signed)
}

// Signs all of the URLs within a historical manifest
func signManifest(bucket *storage.BucketHandle, manifest string) (string, error) {
	var result strings.Builder
	for i, line := range strings.Split(manifest, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			result.WriteString(line + "\n")
			continue
		}
		url, err := bucket.SignedURL(trimmed, &storage.SignedURLOptions{
			Method:  "GET",
			Expires: time.Now().Add(15 * time.Minute),
		})
		if err != nil {
			slog.Error("signManifest failed", "lineIdx", i, "object", trimmed, "error", err)
			return "", fmt.Errorf("signing %s: %w", trimmed, err)
		}
		slog.Debug("signManifest signed segment", "lineIdx", i, "object", trimmed)
		result.WriteString(url + "\n")
	}
	return result.String(), nil
}
