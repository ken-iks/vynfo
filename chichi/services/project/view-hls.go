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
	userId := r.URL.Query().Get("userId")

	if userId == "" {
		slog.Error("cannot view video without a user id")
		http.Error(w, "missing user id", http.StatusBadRequest)
		return
	}
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
	bucket := p.storageClient.Bucket("vedit-v1")
	slog.Info("GetManifest request", "kind", kind, "manifestId", manifestId)
	if kind == "branch" {
		manifest, okay := p.manifestCache.Find(userId, branchId)
		if okay {
			slog.Info("cache hit!", "userId", userId, "branchId", branchId)
			serveManifest(w, manifest)
			return
		}
	}
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
	expiry := time.Now().Add(15 * time.Minute)
	manifest := string(raw)
	signed, err := video.SignManifest(bucket, manifest, expiry)
	if err != nil {
		slog.Error("GetManifest failed to sign manifest", "path", path, "error", err)
		http.Error(w, "failed to sign manifest", http.StatusInternalServerError)
		return
	}
	if kind == "branch" {
		p.manifestCache.Add(userId, branchId, signed, time.Until(expiry))
		slog.Info("added branch to manifest cache", "userId", userId, "branch", branchId)
	}
	serveManifest(w, signed)
}

func serveManifest(w http.ResponseWriter, signedManifest string) {
	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	io.WriteString(w, signedManifest)
}
