import { useCallback, useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { Card, CardContent } from "../ui/card";
import { HeaderPortal } from "../HeaderSlot";
import { useBreadcrumbs } from "../Breadcrumbs";
import { useAuth } from "../providers/AuthProvider";
import { backendUrl, client } from "@/lib/client";
import type {
  BranchMetadata,
  MediaAudioMetadata,
  MediaImageMetadata,
  MediaVideoMetadata,
  ProjectMetadata,
} from "@/gen/proto/v1/projects_pb";
import { AudioPlayer, VideoPlayer } from "../project-editor/VideoPlayer";
import { VideoCanvas } from "../project-editor/VideoCanvas";
import { MediaOverlayCanvas } from "../upload/MediaOverlayCanvas";
import { EmptyVideoPlayer } from "../upload/EmptyVideoPlayer";
import { VideoPlayerPlaceholder } from "../project-editor/VideoPlayerPlaceholder";
import { PlaybackControls } from "../upload/PlaybackControls";
import { editorStore } from "../stores/editor";
import { mediaAssetStore } from "../stores/mediaAssets";
import { EditorTimeline } from "../project-editor/EditorTimeline";
import { CommitDialog } from "../project-editor/CommitDialog";
import { VersionsSheet } from "../project-editor/VersionsSheet";
import { cn } from "@/lib/utils";

export function ProjectView({ project }: { project: ProjectMetadata }) {
  const [currVideoPlayingSrc, setCurrVideoPlayingSrc] = useState("");
  const [currAudioPlayingSrc, setCurrAudioPlayingSrc] = useState("");
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );
  const [readyVideoSrc, setReadyVideoSrc] = useState("");

  const [currProjectVideos, setCurrProjectVideos] = useState<
    MediaVideoMetadata[]
  >([]);
  const [currProjectImages, setCurrProjectImages] = useState<
    MediaImageMetadata[]
  >([]);
  const [currProjectAudios, setCurrProjectAudios] = useState<
    MediaAudioMetadata[]
  >([]);
  const [branches, setBranches] = useState<BranchMetadata[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");

  const userId = useAuth();
  const editorSnap = useSnapshot(editorStore);
  const selectedBranchMetadata = branches.find(
    (b) => b.name === selectedBranch,
  );

  useBreadcrumbs([
    { label: "Projects", to: "/projects" },
    {
      label: selectedBranch
        ? `${project.name} (${selectedBranch})`
        : project.name,
    },
  ]);
  const isVideoReadyToPlay =
    currVideoPlayingSrc !== "" && readyVideoSrc === currVideoPlayingSrc;
  const branchVideoUrl = useCallback(
    (branchId: string, params: Record<string, string>) => {
      const searchParams = new URLSearchParams({
        branchId,
        userId,
        ...params,
      });
      return backendUrl(`/video?${searchParams.toString()}`);
    },
    [userId],
  );
  const handleVideoReadyToPlay = useCallback(() => {
    setReadyVideoSrc(currVideoPlayingSrc);
  }, [currVideoPlayingSrc]);
  const audioTimelineTimeSeconds = useCallback(
    (timelineSeconds: number) => {
      const timelineMs = BigInt(Math.floor(timelineSeconds * 1000));
      let audioProgramMs = 0n;

      for (const section of editorStore.audioSections) {
        const duration = section.endTimeMillis - section.startTimeMillis;
        if (
          section.startTimeMillis <= timelineMs &&
          timelineMs < section.endTimeMillis
        ) {
          return (
            Number(audioProgramMs + (timelineMs - section.startTimeMillis)) /
            1000
          );
        }
        if (timelineMs >= section.endTimeMillis) {
          audioProgramMs += duration;
        }
      }

      return null;
    },
    [editorSnap.audioSections],
  );

  useEffect(() => {
    if (!videoElement || !audioElement || currAudioPlayingSrc === "") return;

    const syncAudioToVideo = (forceSeek: boolean) => {
      audioElement.muted = videoElement.muted;
      audioElement.volume = videoElement.volume;
      audioElement.playbackRate = videoElement.playbackRate;
      const audioTime = audioTimelineTimeSeconds(videoElement.currentTime);
      if (audioTime === null) {
        audioElement.pause();
        return;
      }
      if (forceSeek || Math.abs(audioElement.currentTime - audioTime) > 0.5) {
        audioElement.currentTime = audioTime;
      }
      if (videoElement.paused || videoElement.ended) {
        audioElement.pause();
        return;
      }
      void audioElement.play();
    };

    const pauseAudio = () => audioElement.pause();
    // Tiny corrective seeks are audible, so keep hard sync to lifecycle events
    // and only correct playback drift once it is large enough to matter.
    const hardSyncAudio = () => syncAudioToVideo(true);
    const softSyncAudio = () => syncAudioToVideo(false);
    const intervalId = window.setInterval(softSyncAudio, 1000);

    hardSyncAudio();
    videoElement.addEventListener("play", hardSyncAudio);
    videoElement.addEventListener("pause", pauseAudio);
    videoElement.addEventListener("ended", pauseAudio);
    videoElement.addEventListener("seeked", hardSyncAudio);
    videoElement.addEventListener("timeupdate", softSyncAudio);
    videoElement.addEventListener("ratechange", hardSyncAudio);
    videoElement.addEventListener("volumechange", softSyncAudio);

    return () => {
      window.clearInterval(intervalId);
      videoElement.removeEventListener("play", hardSyncAudio);
      videoElement.removeEventListener("pause", pauseAudio);
      videoElement.removeEventListener("ended", pauseAudio);
      videoElement.removeEventListener("seeked", hardSyncAudio);
      videoElement.removeEventListener("timeupdate", softSyncAudio);
      videoElement.removeEventListener("ratechange", hardSyncAudio);
      videoElement.removeEventListener("volumechange", softSyncAudio);
    };
  }, [
    audioElement,
    audioTimelineTimeSeconds,
    currAudioPlayingSrc,
    videoElement,
  ]);

  const loadBranchIntoEditor = async (branch: BranchMetadata | undefined) => {
    if (branch?.tipCommitId) {
      const commit = await client.getCommit({
        commitId: branch.tipCommitId,
        branchId: branch.id,
      });
      editorStore.loadState(commit.commitState);
      setCurrVideoPlayingSrc(branchVideoUrl(branch.id, {}));
      setCurrAudioPlayingSrc(
        commit.commitState?.audioSections.length
          ? branchVideoUrl(branch.id, { audio: "1" })
          : "",
      );
    } else {
      editorStore.loadState(undefined);
      setCurrVideoPlayingSrc("");
      setCurrAudioPlayingSrc("");
    }
  };

  const handleBranchChange = async (branchName: string) => {
    setSelectedBranch(branchName);
    const branch = branches.find((b) => b.name === branchName);
    await loadBranchIntoEditor(branch);
  };

  useEffect(() => {
    let ignore = false;
    setCurrProjectVideos([]);
    setCurrProjectImages([]);
    setCurrProjectAudios([]);

    const fetchAssets = async () => {
      const assets = await client.listProjectAssets({
        projectId: project.id,
      });
      if (ignore) return;
      setCurrProjectVideos(assets.videos);
      setCurrProjectImages(assets.images);
      setCurrProjectAudios(assets.audios);
      for (const image of assets.images) {
        mediaAssetStore.setImageUrl(image.assetId, image.signedUrl);
      }
    };
    fetchAssets();
    return () => {
      ignore = true;
    };
  }, [project.id]);

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
        editorStore.loadState(undefined);
        setCurrVideoPlayingSrc("");
        setCurrAudioPlayingSrc("");
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
          projectId: project.id,
          branchId: branch.id,
          autoSaveState: editorStore.currentState(),
        })
        .then(() => {
          if (branch) {
            setCurrVideoPlayingSrc(
              branchVideoUrl(branch.id, { v: `autosave-${revision}` }),
            );
            setCurrAudioPlayingSrc(
              editorStore.audioSections.length
                ? branchVideoUrl(branch.id, {
                    audio: "1",
                    v: `autosave-${revision}`,
                  })
                : "",
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
      setCurrVideoPlayingSrc(branchVideoUrl(branch.id, { v: newCommitId }));
      setCurrAudioPlayingSrc(
        editorStore.audioSections.length
          ? branchVideoUrl(branch.id, { audio: "1", v: newCommitId })
          : "",
      );
    }
  };

  const restoreCommit = async (commitId: string) => {
    const branch = selectedBranchMetadata;
    if (!branch) return;
    const commit = await client.getCommit({ commitId, branchId: branch.id });
    editorStore.loadState(commit.commitState);
    await client.autoSave({
      projectId: project.id,
      branchId: branch.id,
      autoSaveState: editorStore.currentState(),
    });
    setCurrVideoPlayingSrc(
      branchVideoUrl(branch.id, { v: `restore-${commitId}` }),
    );
    setCurrAudioPlayingSrc(
      editorStore.audioSections.length
        ? branchVideoUrl(branch.id, { audio: "1", v: `restore-${commitId}` })
        : "",
    );
  };

  return (
    <div className="flex min-w-0 flex-col items-center overflow-x-hidden">
      <HeaderPortal>
        <div className="flex items-center gap-2">
          <CommitDialog
            projectId={project.id}
            branchName={selectedBranch}
            tipCommitId={selectedBranchMetadata?.tipCommitId}
            disabled={
              editorSnap.sections.length === 0 &&
              editorSnap.audioSections.length === 0
            }
            onCommitSuccess={handleCommitSuccess}
          />
          <VersionsSheet
            projectId={project.id}
            branches={branches}
            selectedBranch={selectedBranch}
            branchId={selectedBranchMetadata?.id}
            tipCommitId={selectedBranchMetadata?.tipCommitId}
            onBranchChange={handleBranchChange}
            onRestore={restoreCommit}
          />
        </div>
      </HeaderPortal>
      <Card
        className={cn("w-2/3 min-w-0 max-w-full gap-0 overflow-hidden py-0")}
      >
        <CardContent className="min-w-0 overflow-hidden px-0">
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
                {currAudioPlayingSrc !== "" ? (
                  <AudioPlayer
                    src={currAudioPlayingSrc}
                    ref={setAudioElement}
                  />
                ) : null}
              </div>
            ) : (
              <EmptyVideoPlayer />
            )}
          </div>
          <div className="border-y bg-muted/20 px-3 py-1">
            <PlaybackControls video={videoElement} />
          </div>
          <div className="h-96 min-w-0 overflow-hidden px-4 py-3">
            <EditorTimeline
              availableVideos={currProjectVideos}
              availableAudios={currProjectAudios}
              availableImages={currProjectImages}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
