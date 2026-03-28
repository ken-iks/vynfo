package video

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/storage"
)

const MANIFEST_LIVE_BASE = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:EVENT`

const MANIFEST_PERSISTED_BASE = `#EXTM3U
#EXT-X-VERSION:3
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
	LiveFile  *os.File
	Persisted string
}

// Writes the intital bytes to the manifest files
func StartManifest(videoID string, manifestFile *os.File, client *storage.Client) ManifestBuilder {
	manifestFile.WriteString(MANIFEST_LIVE_BASE)
	manifestFile.Sync()
	return ManifestBuilder{
		Storage:   client,
		VideoID:   videoID,
		LiveFile:  manifestFile,
		Persisted: MANIFEST_PERSISTED_BASE,
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
	builder.Persisted += fmt.Sprintf("\n#EXTINF:%s,\n%s", seg.durationString, seg.path)
	bucket := builder.Storage.Bucket("vedit-v1")
	w := bucket.Object(seg.path).NewWriter(ctx)
	_, err := uploadFile(w, seg.path, seg.path, nil)
	if err != nil {
		return err
	}
	// append signed url of segment to the in memory manifest
	fmt.Fprintf(builder.LiveFile, "\n#EXTINF:%s,\n%s", seg.durationString, seg.path)
	builder.LiveFile.Sync()
	slog.Info("Segment uploaded", "path", seg.path)
	return nil
}

// Purges the segment files stored locally for a given videoID
// Will be a no op if the manifest no longer exists for the file
func PurgeLocalCache(videoID string) {
	manifestPath := fmt.Sprintf("%s.m3u8", videoID)
	if _, err := os.Stat(manifestPath); err != nil {
		return
	}
	os.Remove(manifestPath)
	os.RemoveAll(fmt.Sprintf("segments/%s", videoID))
	slog.Info("Purged local cache", "videoID", videoID)
}

// Writes the historical manifest to cloud storage appending the final
// line to it.
func (builder *ManifestBuilder) FinishUpload(ctx context.Context) (string, error) {
	builder.LiveFile.WriteString("\n#EXT-X-ENDLIST")
	builder.LiveFile.Sync()

	builder.Persisted += "\n#EXT-X-ENDLIST"
	bucket := builder.Storage.Bucket("vedit-v1")
	historicalPath := fmt.Sprintf("manifests/%s.m3u8", builder.VideoID)
	w := bucket.Object(historicalPath).NewWriter(ctx)
	_, err := uploadString(
		w,
		builder.Persisted,
		historicalPath,
		nil,
	)
	if err != nil {
		return "", err
	}
	return "", nil
}
