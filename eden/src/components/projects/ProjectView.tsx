import { useEffect, useState } from "react";
import { Card, CardContent } from "../ui/card";
import { useAuth } from "../providers/AuthProvider";
import { client } from "@/lib/client";
import type {
  MediaImageMetadata,
  MediaTextMetadata,
  MediaVideoMetadata,
  ProjectMetadata,
} from "@/gen/proto/v1/api_pb";
import { VideoPlayer } from "../video/VideoPlayer";
import { EmptyVideoPlayer } from "../video/EmptyVideoPlayer";
import { Table } from "../shared/Table";
import { editorStore } from "../stores/editor";
import { AssetActions } from "./AssetActions";
import { formatDuration } from "@/lib/utils";
import { EditorTimeline } from "./EditorTimeline";
import { SectionTitle } from "../shared/SectionTitle";

export function ProjectView({ project }: { project: ProjectMetadata }) {
  const [currVideoPlayingSrc, setCurrVideoPlayingSrc] = useState("");

  const [currProjectVideos, setCurrProjectVideos] = useState<
    MediaVideoMetadata[]
  >([]);
  const [currProjectTexts, setCurrProjectTexts] = useState<MediaTextMetadata[]>(
    [],
  );
  const [currProjectImages, setCurrProjectImages] = useState<
    MediaImageMetadata[]
  >([]);

  const userId = useAuth();

  const handleVideoSelected = (v: MediaVideoMetadata) => {
    setCurrVideoPlayingSrc(`/video?videoId=${v.assetId}&mode=historical`);
  };

  useEffect(() => {
    const fetchAssets = async () => {
      const assets = await client.listProjectAssets({
        userId,
        projectId: project.id,
      });
      setCurrProjectVideos(assets.videos);
      setCurrProjectImages(assets.images);
      setCurrProjectTexts(assets.textBoxes);

      // TODO: fetch commit state
      editorStore.loadSections([]);
    };
    fetchAssets();
  }, [userId, project]);

  return (
    <div className="flex flex-col items-center">
      <SectionTitle>{project.name}</SectionTitle>
      <div className="flex flex-col w-2/3 gap-4">
        <Card>
          <CardContent>
            {currVideoPlayingSrc !== "" ? (
              <VideoPlayer src={currVideoPlayingSrc} />
            ) : (
              <EmptyVideoPlayer />
            )}
          </CardContent>
        </Card>
        <Card className="h-96">
          <div className="pl-5">
            <SectionTitle>Current branch: Main</SectionTitle>
          </div>
          <CardContent className="h-full">
            <EditorTimeline />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            {currProjectVideos.length > 0 && (
              <Table<MediaVideoMetadata>
                title="Videos"
                data={currProjectVideos}
                columns={[
                  { key: "title", header: "Title" },
                  {
                    key: "duration",
                    header: "Duration",
                    render: (_value, row) =>
                      formatDuration(row.duration * 1000),
                  },
                ]}
                onSelectRow={(v) => handleVideoSelected(v)}
                rowActions={(row) => (
                  <AssetActions type="video" metadata={row} />
                )}
              />
            )}
            {currProjectTexts.length > 0 && (
              <Table<MediaTextMetadata>
                title="Images"
                data={currProjectTexts}
                columns={[{ key: "assetId", header: "Asset ID" }]}
                onSelectRow={() => {}}
                rowActions={(row) => (
                  <AssetActions type="text" metadata={row} />
                )}
              />
            )}
            {currProjectImages.length > 0 && (
              <Table<MediaImageMetadata>
                title="Text Boxes"
                data={currProjectImages}
                columns={[{ key: "assetId", header: "Asset ID" }]}
                onSelectRow={() => {}}
                rowActions={(row) => (
                  <AssetActions type="image" metadata={row} />
                )}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
