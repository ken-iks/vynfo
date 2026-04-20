package video

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloud.google.com/go/storage"
	"github.com/google/uuid"
	"vynfo.com/vynfo/internal/db"
)

const MANIFEST_LIVE_BASE = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:EVENT`

const MANIFEST_PERSISTED_BASE = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD`

// Manifest builder is what we use as our upload client object. The live file is our ongoing upload
// manifest that can be resolved by HLS players whilst a long upload is going on. And then the persisted
// string will be written to cloud storage once all segments have finished being written, and then
// from there the cached segment files can be purged and further reads will be made from cloud store
type ManifestBuilder struct {
	Storage   *storage.Client
	VideoID   string
	VideoUUID uuid.UUID
	Queries   *db.Queries
	segIndex  int64
	lines     strings.Builder
}

// Writes the intital bytes to the manifest files
func StartManifest(
	videoID string,
	videoUUID uuid.UUID,
	client *storage.Client,
	queries *db.Queries,
) ManifestBuilder {
	return ManifestBuilder{
		Storage:   client,
		VideoID:   videoID,
		VideoUUID: videoUUID,
		Queries:   queries,
	}
}

// Base uploader for writing to bytes to cloud storage
// use withSignedUrl to generate a signed url for the recently uploaded bytes
// Default url lifetime is 15 mins
func uploadBytes(
	writer *storage.Writer,
	source io.Reader,
	objectPath string,
	withSignedUrl *storage.BucketHandle,
) (string, error) {
	if _, err := io.Copy(writer, source); err != nil {
		writer.Close()
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	if withSignedUrl != nil {
		opts := &storage.SignedURLOptions{
			Method:  "GET",
			Expires: time.Now().Add(15 * time.Minute),
		}
		url, err := withSignedUrl.SignedURL(objectPath, opts)
		if err != nil {
			return "", err
		}
		return url, nil
	}
	return "", nil
}

// uploads a string to the cloud store
// include bucket handle if you want to generate a signed url for the uploaded string
func uploadString(
	writer *storage.Writer,
	s string,
	objectPath string,
	withSignedUrl *storage.BucketHandle,
) (string, error) {
	return uploadBytes(writer, strings.NewReader(s), objectPath, withSignedUrl)
}

// uploads a local file stored at fp to the cloud store
// include bucket handle if you want to generate a signed url for the uploaded file
func uploadFile(
	writer *storage.Writer,
	fp string,
	objectPath string,
	withSignedUrl *storage.BucketHandle,
) (string, error) {
	f, err := os.Open(fp)
	if err != nil {
		return "", err
	}
	defer f.Close()
	return uploadBytes(writer, f, objectPath, withSignedUrl)
}

// Uploads the video segment to the Builder's storage client and
// adds the corresponding line to the mandifest files
func (builder *ManifestBuilder) UploadSegment(seg VideoSegment, ctx context.Context) error {
	objectKey := fmt.Sprintf("segments/%s/%s", builder.VideoID, filepath.Base(seg.path))
	bucket := builder.Storage.Bucket("vedit-v1")
	w := bucket.Object(objectKey).NewWriter(ctx)
	if _, err := uploadFile(w, seg.path, objectKey, nil); err != nil {
		return err
	}

	fmt.Fprintf(&builder.lines, "\n#EXTINF:%s,\n%s", seg.durationString, objectKey)

	manifestPath := fmt.Sprintf("manifests/%s.m3u8", builder.VideoID)
	mw := bucket.Object(manifestPath).NewWriter(ctx)
	if _, err := uploadString(mw, MANIFEST_LIVE_BASE+builder.lines.String(), manifestPath, nil); err != nil {
		slog.Warn("failed to write live manifest to gcs", "videoID", builder.VideoID, "error", err)
	}

	offsets, err := GenerateOffsets(seg.path)
	if err != nil {
		return fmt.Errorf("offset generation failed for %s: %w", seg.path, err)
	}
	for ts, kf := range offsets {
		if _, err := builder.Queries.CreateKeyFrame(ctx, db.CreateKeyFrameParams{
			VideoID:             builder.VideoUUID,
			TimestampInVideo:    int64(ts),
			SegmentIdx:          builder.segIndex,
			ByteOffsetInSegment: int64(kf.ByteOffset),
			SizeInBytes:         int64(kf.Size),
		}); err != nil {
			return err
		}
	}
	builder.segIndex++

	if err := os.Remove(seg.path); err != nil {
		slog.Warn("failed to remove local segment", "path", seg.path, "error", err)
	}
	slog.Info("Segment uploaded", "path", objectKey)
	return nil
}

// Writes the historical manifest to cloud storage appending the final
// line to it
func (builder *ManifestBuilder) FinishUpload(ctx context.Context) error {
	bucket := builder.Storage.Bucket("vedit-v1")
	historicalPath := fmt.Sprintf("manifests/%s.m3u8", builder.VideoID)
	w := bucket.Object(historicalPath).NewWriter(ctx)
	final := MANIFEST_PERSISTED_BASE + builder.lines.String() + "\n#EXT-X-ENDLIST"
	_, err := uploadString(w, final, historicalPath, nil)
	if err != nil {
		return err
	}
	return nil
}

func UploadBranchManifestToCloud(
	ctx context.Context,
	client *storage.Client,
	manifest string,
	branchId string,
) error {
	bucket := client.Bucket("vedit-v1")
	path := fmt.Sprintf("manifests/%s.m3u8", branchId)
	w := bucket.Object(path).NewWriter(ctx)
	_, err := uploadString(
		w,
		manifest,
		path,
		nil,
	)
	if err != nil {
		return err
	}
	return nil
}
