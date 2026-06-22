package project

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"vynfo.com/vynfo/video"
)

// GetManifest handles GET /video?videoId=abc or GET /video?branchId=abc
// HLS protocal doesn't support endpoints over connect RPC - so we expose this endpoint
// over pure https. Raw video manifests are keyed by video id; branch playback manifests
// are keyed by branch id — both live under manifests/<id>.m3u8.
func (p *ProjectServiceServer) GetManifest(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	branchId := r.URL.Query().Get("branchId")
	videoId := r.URL.Query().Get("videoId")
	audioId := r.URL.Query().Get("audioId")
	isAudio := r.URL.Query().Get("audio") == "1"
	userId := r.URL.Query().Get("userId")
	logger := slog.Default().With("user_id", userId)

	if userId == "" {
		logger.ErrorContext(r.Context(), "cannot view video without a user id")
		http.Error(w, "missing user id", http.StatusBadRequest)
		return
	}
	manifestId := branchId
	kind := "branch"
	cacheKind := video.ManifestKindVideo
	if manifestId == "" {
		manifestId = videoId
		kind = "video"
	}
	if manifestId == "" {
		manifestId = audioId
		kind = "audio"
	}
	if manifestId == "" {
		logger.WarnContext(
			r.Context(),
			"GetManifest missing id",
			"branchId",
			branchId,
			"videoId",
			videoId,
			"audioId",
			audioId,
		)
		http.Error(w, "missing branchId, videoId, or audioId", http.StatusBadRequest)
		return
	}
	if branchId != "" && isAudio {
		manifestId = fmt.Sprintf("%s-audio", branchId)
		cacheKind = video.ManifestKindAudio
	}
	logger = logger.With("manifest_kind", kind, "manifest_id", manifestId, "cache_kind", cacheKind)
	bucket := p.storageClient.Bucket("vedit-v1")
	logger.InfoContext(r.Context(), "manifest requested")
	if kind == "branch" {
		manifest, okay := p.manifestCache.Find(userId, branchId, cacheKind)
		if okay {
			logger.DebugContext(r.Context(), "manifest cache hit", "branch_id", branchId)
			serveManifest(w, manifest)
			return
		}
	}
	path := fmt.Sprintf("manifests/%s.m3u8", manifestId)
	reader, err := bucket.Object(path).NewReader(ctx)
	if err != nil {
		logger.ErrorContext(r.Context(), "GetManifest failed to open manifest", "path", path, "error", err)
		http.Error(w, "invalid manifest id", http.StatusBadRequest)
		return
	}
	defer reader.Close()
	raw, err := io.ReadAll(reader)
	if err != nil {
		logger.ErrorContext(r.Context(), "GetManifest failed to read manifest", "path", path, "error", err)
		http.Error(w, "failed to read manifest", http.StatusInternalServerError)
		return
	}
	logger.DebugContext(r.Context(), "GetManifest raw manifest", "path", path, "body", string(raw))
	expiry := time.Now().Add(15 * time.Minute)
	manifest := string(raw)
	signed, err := video.SignManifest(bucket, manifest, expiry)
	if err != nil {
		logger.ErrorContext(r.Context(), "GetManifest failed to sign manifest", "path", path, "error", err)
		http.Error(w, "failed to sign manifest", http.StatusInternalServerError)
		return
	}
	if kind == "branch" {
		p.manifestCache.Add(userId, branchId, cacheKind, signed, time.Until(expiry))
		logger.DebugContext(r.Context(), "manifest cached", "branch_id", branchId)
	}
	serveManifest(w, signed)
}

func serveManifest(w http.ResponseWriter, signedManifest string) {
	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	io.WriteString(w, signedManifest)
}
