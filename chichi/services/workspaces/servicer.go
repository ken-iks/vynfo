package workspaces

import (
	"database/sql"

	"vynfo.com/vynfo/gen/proto/v1/v1connect"
	dbgen "vynfo.com/vynfo/internal/db"
)

type WorkspacesServiceServer struct {
	v1connect.UnimplementedWorkspacesServiceHandler
	db      *sql.DB
	queries *dbgen.Queries
}

func NewWorkspacesServiceServer(
	db *sql.DB,
	queries *dbgen.Queries,
) *WorkspacesServiceServer {
	return &WorkspacesServiceServer{
		db:      db,
		queries: queries,
	}
}
