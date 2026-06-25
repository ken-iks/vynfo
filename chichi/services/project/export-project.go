package project

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/encoding/protojson"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/shared"
	"vynfo.com/vynfo/video"
)

func (p *ProjectServiceServer) ExportProject(
	ctx context.Context,
	req *connect.Request[v1.ExportProjectRequest],
) (*connect.Response[v1.ExportProjectResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, p.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
		"project_id", req.Msg.GetProjectId(),
		"commit_id", req.Msg.GetCommitId(),
	)

	workspaceID, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing workspace id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	projectID, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	logger.InfoContext(ctx, "project export started")

	project, err := p.queries.GetProject(ctx, projectID)
	if err != nil {
		logger.ErrorContext(ctx, "error fetching project", "error", err)
		return nil, connect.NewError(connect.CodeNotFound, err)
	}
	if project.WorkspaceID != workspaceID {
		return nil, connect.NewError(
			connect.CodeNotFound,
			fmt.Errorf("project not found in workspace"),
		)
	}

	commit, err := p.getCommitForExport(ctx, projectID, req.Msg.GetCommitId())
	if err != nil {
		return nil, err
	}

	var state v1.CommitEditRequest
	if err := protojson.Unmarshal(commit.State, &state); err != nil {
		logger.ErrorContext(ctx, "error unmarshalling commit state", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger = logger.With("commit_id", commit.ID.String())

	builder, err := video.PrepareExporter(state.GetCommitState(), p.storageClient, "output.mp4")
	if err != nil {
		logger.ErrorContext(ctx, "error preparing exporter", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	cmd, err := builder.BuildExportCommand()
	if err != nil {
		logger.ErrorContext(ctx, "error building export command", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	tempDir, err := os.MkdirTemp("", "vynfo-export-*")
	if err != nil {
		logger.ErrorContext(ctx, "error creating export temp dir", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer os.RemoveAll(tempDir)

	cmd.Dir = tempDir
	logger.InfoContext(ctx, "project export command started")
	if output, err := cmd.CombinedOutput(); err != nil {
		logger.ErrorContext(
			ctx,
			"error running export command",
			"error",
			err,
			"output",
			string(output),
		)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "project export command completed")

	exportFile, err := os.Open(filepath.Join(tempDir, "output.mp4"))
	if err != nil {
		logger.ErrorContext(ctx, "error opening export output", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer exportFile.Close()

	bucket := p.storageClient.Bucket("vedit-v1")
	objectPath := fmt.Sprintf(
		"exports/%s/%s/%s.mp4",
		workspaceID.String(),
		projectID.String(),
		commit.ID.String(),
	)
	writer := bucket.Object(objectPath).NewWriter(ctx)
	writer.ContentType = "video/mp4"
	signedURL, err := shared.UploadBytes(writer, exportFile, objectPath, bucket)
	if err != nil {
		logger.ErrorContext(ctx, "error uploading export", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "project export completed", "object_path", objectPath)

	return connect.NewResponse(&v1.ExportProjectResponse{
		SignedUrlForDownload: signedURL,
	}), nil
}

func (p *ProjectServiceServer) getCommitForExport(
	ctx context.Context,
	projectID uuid.UUID,
	commitID string,
) (db.Commit, error) {
	if commitID != "" {
		parsedCommitID, err := uuid.Parse(commitID)
		if err != nil {
			slog.Error("error parsing commit id", "error", err)
			return db.Commit{}, connect.NewError(connect.CodeInvalidArgument, err)
		}
		commit, err := p.queries.GetCommitByID(ctx, parsedCommitID)
		if err != nil {
			slog.Error("error fetching commit", "error", err)
			return db.Commit{}, connect.NewError(connect.CodeNotFound, err)
		}
		if commit.ProjectID != projectID {
			return db.Commit{}, connect.NewError(
				connect.CodeNotFound,
				fmt.Errorf("commit not found in project"),
			)
		}
		return commit, nil
	}

	mainBranch, err := p.queries.GetBranchByName(ctx, db.GetBranchByNameParams{
		ProjectID: projectID,
		Name:      "main",
	})
	if err != nil {
		slog.Error("error fetching main branch", "error", err)
		return db.Commit{}, connect.NewError(connect.CodeNotFound, err)
	}
	if !mainBranch.TipCommitID.Valid {
		return db.Commit{}, connect.NewError(
			connect.CodeFailedPrecondition,
			fmt.Errorf("project has no commits to export"),
		)
	}
	commit, err := p.queries.GetCommitByID(ctx, mainBranch.TipCommitID.UUID)
	if err != nil {
		slog.Error("error fetching main branch tip commit", "error", err)
		return db.Commit{}, connect.NewError(connect.CodeNotFound, err)
	}
	return commit, nil
}
