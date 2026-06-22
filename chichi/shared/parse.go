package shared

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
)

func ParseUUID(
	ctx context.Context,
	logger *slog.Logger,
	field string,
	value string,
) (uuid.UUID, error) {
	parsed, err := uuid.Parse(value)
	if err != nil {
		logger.ErrorContext(ctx, "error parsing uuid", "field", field, "error", err)
		return uuid.UUID{}, connect.NewError(connect.CodeInvalidArgument, err)
	}
	return parsed, nil
}
