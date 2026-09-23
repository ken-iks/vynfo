package vfs

import (
	"database/sql"

	"cloud.google.com/go/storage"
	"vynfo.com/vynfo/gen/proto/v1/v1connect"
	dbgen "vynfo.com/vynfo/internal/db"
)

type FileServiceServer struct {
	v1connect.UnimplementedFileServiceHandler
	storageClient *storage.Client
	db            *sql.DB
	queries       *dbgen.Queries
}

func NewFileServiceServer(
	c *storage.Client,
	db *sql.DB,
	queries *dbgen.Queries,
) *FileServiceServer {
	return &FileServiceServer{
		storageClient: c,
		db:            db,
		queries:       queries,
	}
}
