package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/storage"
	"vynfo.com/vynfo/video"
)

type ViewMode string

const (
	Live       ViewMode = "live"
	Historical ViewMode = "historical"
)

// GetManifest handles GET /video?videoId=abc&mode=abc
// HLS protocal doesn't support endpoints over connect RPC - so we expose this endpoint
// over pure https
func (v *VideoServiceServer) GetManifest(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	videoId := r.URL.Query().Get("videoId")
	mode := ViewMode(r.URL.Query().Get("mode"))

	bucket := v.storageClient.Bucket("vedit-v1")
	switch mode {
	case Live:
		f, err := os.Open(fmt.Sprintf("%s.m3u8", videoId))
		if err != nil {
			http.Error(w, "invalid video id", http.StatusBadRequest)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		io.Copy(w, f)
		return
	case Historical:
		video.PurgeLocalCache(videoId)
		path := fmt.Sprintf("manifests/%s.m3u8", videoId)
		reader, err := bucket.Object(path).NewReader(ctx)
		if err != nil {
			http.Error(w, "invalid video id", http.StatusBadRequest)
			return
		}
		defer reader.Close()
		raw, err := io.ReadAll(reader)
		if err != nil {
			http.Error(w, "failed to read manifest", http.StatusInternalServerError)
			return
		}
		signed, err := signManifest(bucket, string(raw))
		if err != nil {
			http.Error(w, "failed to sign manifest", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		io.WriteString(w, signed)
		return
	default:
		http.Error(w, "cannot handle type yet", http.StatusBadRequest)
	}
}

// Signs all of the URLs within a historical manifest
func signManifest(bucket *storage.BucketHandle, manifest string) (string, error) {
	var result strings.Builder
	for _, line := range strings.Split(manifest, "\n") {
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
			return "", fmt.Errorf("signing %s: %w", trimmed, err)
		}
		result.WriteString(url + "\n")
	}
	return result.String(), nil
}
