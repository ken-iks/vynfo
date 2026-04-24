package spaces

import (
	"database/sql"

	"vynfo.com/vynfo/gen/proto/v1/v1connect"
	dbgen "vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/messages"
)

type SpacesServiceServer struct {
	v1connect.UnimplementedSpacesServiceHandler
	db *sql.DB
	queries *dbgen.Queries
	observer *messages.MessageObserver
}

func NewSpacesServiceServer(
	db *sql.DB,
	queries *dbgen.Queries,
	observer *messages.MessageObserver,
) *SpacesServiceServer {
	return &SpacesServiceServer{
		db: db, queries: queries, observer: observer,
	}
}