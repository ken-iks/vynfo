package vfs

import (
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func directoryMetadataList(directories []db.Directory) []*v1.DirectoryMetadata {
	directoryMeta := make([]*v1.DirectoryMetadata, 0, len(directories))
	for _, directory := range directories {
		directoryMeta = append(directoryMeta, &v1.DirectoryMetadata{
			Id:   directory.ID.String(),
			Name: directory.DisplayName,
		})
	}
	return directoryMeta
}
