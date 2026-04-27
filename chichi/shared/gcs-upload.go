package shared

import (
	"io"
	"strings"
	"time"

	"cloud.google.com/go/storage"
)

// Base uploader for writing to bytes to cloud storage
// use withSignedUrl to generate a signed url for the recently uploaded bytes
// Default url lifetime is 15 mins
func UploadBytes(
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
func UploadString(
	writer *storage.Writer,
	s string,
	objectPath string,
	withSignedUrl *storage.BucketHandle,
) (string, error) {
	return UploadBytes(writer, strings.NewReader(s), objectPath, withSignedUrl)
}
