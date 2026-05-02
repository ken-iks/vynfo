import { useCallback, useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { Card, CardContent } from "../../ui/card";
import { useAuth } from "../../providers/AuthProvider";
import { client } from "@/lib/client";
import type {
  BranchMetadata,
  MediaImageMetadata,
  MediaTextMetadata,
  MediaVideoMetadata,
  ProjectMetadata,
} from "@/gen/proto/v1/projects_pb";
import { VideoPlayer } from "../../video/VideoPlayer";
import { VideoCanvas } from "../../video/VideoCanvas";
import { MediaOverlayCanvas } from "../../video/MediaOverlayCanvas";
import { EmptyVideoPlayer } from "../../video/EmptyVideoPlayer";
import { VideoPlayerPlaceholder } from "../../video/VideoPlayerPlaceholder";
import { PlaybackControls } from "../../video/PlaybackControls";
import { editorStore } from "../../stores/editor";
import { mediaAssetStore } from "../../stores/mediaAssets";
import { EditorTimeline } from "../editor/EditorTimeline";
import { CommitDialog } from "../editor/CommitDialog";
import { SectionTitle } from "../../shared/SectionTitle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

export function ProjectView({ project }: { project: ProjectMetadata }) {
  const [currVideoPlayingSrc, setCurrVideoPlayingSrc] = useState("");
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const [readyVideoSrc, setReadyVideoSrc] = useState("");

  const [currProjectVideos, setCurrProjectVideos] = useState<
    MediaVideoMetadata[]
  >([]);
  const [currProjectTexts, setCurrProjectTexts] = useState<MediaTextMetadata[]>(
    [],
  );
  const [currProjectImages, setCurrProjectImages] = useState<
    MediaImageMetadata[]
  >([]);
  const [branches, setBranches] = useState<BranchMetadata[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");

  const userId = useAuth();
  const editorSnap = useSnapshot(editorStore);
  const selectedBranchMetadata = branches.find(
    (b) => b.name === selectedBranch,
  );
  const isVideoReadyToPlay =
    currVideoPlayingSrc !== "" && readyVideoSrc === currVideoPlayingSrc;
  const handleVideoReadyToPlay = useCallback(() => {
    setReadyVideoSrc(currVideoPlayingSrc);
  }, [currVideoPlayingSrc]);

  const loadBranchIntoEditor = async (branch: BranchMetadata | undefined) => {
    if (branch?.tipCommitId) {
      const commit = await client.getCommit({
        commitId: branch.tipCommitId,
        userId,
        branchId: branch.id,
      });
      editorStore.loadSections(commit.commitState);
      setCurrVideoPlayingSrc(`/video?branchId=${branch.id}&userId=${userId}`);
    } else {
      editorStore.loadSections([]);
      setCurrVideoPlayingSrc("");
    }
  };

  const handleBranchChange = async (branchName: string) => {
    setSelectedBranch(branchName);
    const branch = branches.find((b) => b.name === branchName);
    await loadBranchIntoEditor(branch);
  };

  useEffect(() => {
    const fetchAssets = async () => {
      const assets = await client.listProjectAssets({
        userId,
        projectId: project.id,
      });
      setCurrProjectVideos(assets.videos);
      setCurrProjectImages(assets.images);
      for (const image of assets.images) {
        mediaAssetStore.setImageUrl(image.assetId, image.signedUrl);
      }
      for (const text of assets.textBoxes) {
        mediaAssetStore.setTextMarkdown(text.assetId, text.content);
      }
      setCurrProjectTexts(assets.textBoxes);
    };
    fetchAssets();
  }, [userId, project]);

  useEffect(() => {
    const fetchBranches = async () => {
      const res = await client.listProjectBranches({
        projectId: project.id,
      });
      setBranches(res.branches);
      if (res.branches.length > 0) {
        const first = res.branches[0];
        setSelectedBranch(first.name);
        await loadBranchIntoEditor(first);
      } else {
        editorStore.loadSections([]);
        setCurrVideoPlayingSrc("");
      }
    };
    fetchBranches();
  }, [project]);

  useEffect(() => {
    if (editorSnap.editRevision === 0 || selectedBranch === "") return;

    const revision = editorSnap.editRevision;
    const branch = branches.find((b) => b.name === selectedBranch);
    if (!branch) return;
    const timeoutId = window.setTimeout(() => {
      void client
        .autoSave({
          userId,
          projectId: project.id,
          branchId: branch.id,
          autoSaveState: [...editorStore.sections],
        })
        .then(() => {
          if (branch) {
            setCurrVideoPlayingSrc(
              `/video?branchId=${branch.id}&userId=${userId}&v=autosave-${revision}`,
            );
          }
        });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [branches, editorSnap.editRevision, project.id, selectedBranch, userId]);

  const handleCommitSuccess = (newCommitId: string) => {
    setBranches((prev) =>
      prev.map((b) =>
        b.name === selectedBranch ? { ...b, tipCommitId: newCommitId } : b,
      ),
    );
    const branch = branches.find((b) => b.name === selectedBranch);
    if (branch) {
      setCurrVideoPlayingSrc(
        `/video?branchId=${branch.id}&userId=${userId}&v=${newCommitId}`,
      );
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex w-2/3 items-center justify-between gap-4">
        <SectionTitle>{project.name}</SectionTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Branch</span>
            <Select value={selectedBranch} onValueChange={handleBranchChange}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CommitDialog
            projectId={project.id}
            branchName={selectedBranch}
            tipCommitId={selectedBranchMetadata?.tipCommitId}
            disabled={editorSnap.sections.length === 0}
            onCommitSuccess={handleCommitSuccess}
          />
        </div>
      </div>
      <Card className="w-2/3 gap-0 py-0">
        <CardContent className="px-0">
          <div className="flex justify-center px-4 py-4">
            {currVideoPlayingSrc !== "" ? (
              <div className="relative w-full">
                <VideoPlayerPlaceholder />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ visibility: "hidden" }}
                >
                  <VideoPlayer
                    src={currVideoPlayingSrc}
                    onReadyToPlay={handleVideoReadyToPlay}
                    ref={setVideoElement}
                  />
                </div>
                {!isVideoReadyToPlay ? (
                  <div className="absolute inset-0 z-20">
                    <VideoPlayerPlaceholder />
                  </div>
                ) : null}
                <VideoCanvas video={videoElement} />
                <MediaOverlayCanvas />
              </div>
            ) : (
              <EmptyVideoPlayer />
            )}
          </div>
          <div className="border-y bg-muted/20 px-3 py-1">
            <PlaybackControls video={videoElement} />
          </div>
          <div className="h-96 px-4 py-3">
            <EditorTimeline
              availableVideos={currProjectVideos}
              availableImages={currProjectImages}
              availableTexts={currProjectTexts}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
