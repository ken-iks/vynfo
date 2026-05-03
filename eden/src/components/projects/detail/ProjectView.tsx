import { useCallback, useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { Card, CardContent } from "../../ui/card";
import { useAuth } from "../../providers/AuthProvider";
import { client } from "@/lib/client";
import type {
  BranchMetadata,
  MediaAudioMetadata,
  MediaImageMetadata,
  MediaTextMetadata,
  MediaVideoMetadata,
  ProjectMetadata,
} from "@/gen/proto/v1/projects_pb";
import { AudioPlayer, VideoPlayer } from "../../video/VideoPlayer";
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
  const [currProjectTexts, setCurrProjectTexts] = useState<MediaTextMetadata[]>(
    [],
  );
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
  const isVideoReadyToPlay =
    currVideoPlayingSrc !== "" && readyVideoSrc === currVideoPlayingSrc;
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
        userId,
        branchId: branch.id,
      });
      editorStore.loadState(commit.commitState);
      setCurrVideoPlayingSrc(`/video?branchId=${branch.id}&userId=${userId}`);
      setCurrAudioPlayingSrc(
        commit.commitState?.audioSections.length
          ? `/video?branchId=${branch.id}&userId=${userId}&audio=1`
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
    const fetchAssets = async () => {
      const assets = await client.listProjectAssets({
        userId,
        projectId: project.id,
      });
      setCurrProjectVideos(assets.videos);
      setCurrProjectImages(assets.images);
      setCurrProjectAudios(assets.audios);
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
          userId,
          projectId: project.id,
          branchId: branch.id,
          autoSaveState: editorStore.currentState(),
        })
        .then(() => {
          if (branch) {
            setCurrVideoPlayingSrc(
              `/video?branchId=${branch.id}&userId=${userId}&v=autosave-${revision}`,
            );
            setCurrAudioPlayingSrc(
              editorStore.audioSections.length
                ? `/video?branchId=${branch.id}&userId=${userId}&audio=1&v=autosave-${revision}`
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
      setCurrVideoPlayingSrc(
        `/video?branchId=${branch.id}&userId=${userId}&v=${newCommitId}`,
      );
      setCurrAudioPlayingSrc(
        editorStore.audioSections.length
          ? `/video?branchId=${branch.id}&userId=${userId}&audio=1&v=${newCommitId}`
          : "",
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
            disabled={
              editorSnap.sections.length === 0 &&
              editorSnap.audioSections.length === 0
            }
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
          <div className="h-96 px-4 py-3">
            <EditorTimeline
              availableVideos={currProjectVideos}
              availableAudios={currProjectAudios}
              availableImages={currProjectImages}
              availableTexts={currProjectTexts}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
