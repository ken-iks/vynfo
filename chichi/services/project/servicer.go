package project

import (
	"database/sql"

	"cloud.google.com/go/storage"
	"vynfo.com/vynfo/gen/proto/v1/v1connect"
	dbgen "vynfo.com/vynfo/internal/db"
)

type ProjectServiceServer struct {
	v1connect.UnimplementedProjectServiceHandler
	storageClient *storage.Client
	db            *sql.DB
	queries       *dbgen.Queries
}

func NewProjectServiceServer(
	c *storage.Client,
	db *sql.DB,
	queries *dbgen.Queries,
) *ProjectServiceServer {
	return &ProjectServiceServer{storageClient: c, db: db, queries: queries}
}
