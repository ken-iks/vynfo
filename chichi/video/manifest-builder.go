package video

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"cloud.google.com/go/storage"
	"github.com/google/uuid"
	"vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/shared"
)

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

	// maps a segment index to its hls line
	mu           sync.RWMutex
	segmentLines map[int]string
}

type UploadSegmentResult struct {
	ObjectKey string
}

// Writes the intital bytes to the manifest files
func StartManifest(
	videoID string,
	videoUUID uuid.UUID,
	client *storage.Client,
	queries *db.Queries,
) ManifestBuilder {
	return ManifestBuilder{
		Storage:      client,
		VideoID:      videoID,
		VideoUUID:    videoUUID,
		Queries:      queries,
		segmentLines: map[int]string{},
	}
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
	return shared.UploadBytes(writer, f, objectPath, withSignedUrl)
}

// Uploads the video segment to the Builder's storage client and
// adds the corresponding line to the mandifest files
func (builder *ManifestBuilder) UploadSegment(
	seg VideoSegment,
	ctx context.Context,
) (UploadSegmentResult, error) {
	objectKey := fmt.Sprintf("segments/%s/%s", builder.VideoID, filepath.Base(seg.path))
	result := UploadSegmentResult{
		ObjectKey: objectKey,
	}
	bucket := builder.Storage.Bucket("vedit-v1")
	w := bucket.Object(objectKey).NewWriter(ctx)
	if _, err := uploadFile(w, seg.path, objectKey, nil); err != nil {
		return result, err
	}

	base := filepath.Base(seg.path)
	idxStr := strings.TrimSuffix(strings.TrimPrefix(base, "seg_"), ".ts")
	idx, err := strconv.Atoi(idxStr)
	if err != nil {
		slog.Error("could not generate segment index", "path", seg.path)
		return result, fmt.Errorf("could not generate segment index for %s: %w", seg.path, err)
	}
	newline := fmt.Sprintf("\n#EXTINF:%s,\n%s", seg.durationString, objectKey)
	builder.mu.Lock()
	builder.segmentLines[idx] = newline
	builder.mu.Unlock()

	offsets, err := GenerateOffsets(seg.path)
	if err != nil {
		return result, fmt.Errorf("offset generation failed for %s: %w", seg.path, err)
	}

	for ts, kf := range offsets {
		if _, err := builder.Queries.CreateKeyFrame(ctx, db.CreateKeyFrameParams{
			VideoID:             builder.VideoUUID,
			TimestampInVideo:    int64(ts),
			SegmentIdx:          int64(idx),
			ByteOffsetInSegment: int64(kf.ByteOffset),
			SizeInBytes:         int64(kf.Size),
		}); err != nil {
			return result, err
		}
	}

	if err := os.Remove(seg.path); err != nil {
		slog.Warn("failed to remove local segment", "path", seg.path, "error", err)
	}
	slog.Info("Segment uploaded", "path", objectKey)
	return result, nil
}

// Writes the historical manifest to cloud storage appending the final
// line to it (EXT-X-ENDLIST)
func (builder *ManifestBuilder) FinishUpload(ctx context.Context) error {
	bucket := builder.Storage.Bucket("vedit-v1")
	historicalPath := fmt.Sprintf("manifests/%s.m3u8", builder.VideoID)
	w := bucket.Object(historicalPath).NewWriter(ctx)

	// we generate an ordered set of indexes so that we write out our manifest
	// file in the correct order
	builder.mu.RLock()
	idxs := make([]int, 0, len(builder.segmentLines))
	for k := range builder.segmentLines {
		idxs = append(idxs, k)
	}
	sort.Ints(idxs)
	var final strings.Builder
	final.WriteString(MANIFEST_PERSISTED_BASE)

	for _, k := range idxs {
		final.WriteString(builder.segmentLines[k])
	}
	builder.mu.RUnlock()
	final.WriteString("\n#EXT-X-ENDLIST")

	// once manifest file is written, we can upload directly to gcs
	_, err := shared.UploadString(w, final.String(), historicalPath, nil)
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
	_, err := shared.UploadString(
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
