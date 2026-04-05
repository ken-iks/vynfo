import { useEffect, useState } from "react";
import { Card, CardContent } from "../ui/card";
import { useAuth } from "../providers/AuthProvider";
import { client } from "@/lib/client";
import type { MediaImageMetadata, MediaTextMetadata, MediaVideoMetadata, ProjectMetadata } from "@/gen/proto/v1/api_pb";
import { VideoPlayer } from "../video/VideoPlayer";
import { EmptyVideoPlayer } from "../video/EmptyVideoPlayer";
import { Table } from "../shared/Table";


export function ProjectView({ project }: { project: ProjectMetadata} ) {
    const [currVideoPlayingSrc, setCurrVideoPlayingSrc] = useState("");

    const [currProjectVideos, setCurrProjectVideos] = useState<MediaVideoMetadata[]>([]);
    const [currProjectTexts, setCurrProjectTexts] = useState<MediaTextMetadata[]>([]);
    const [currProjectImages, setCurrProjectImages] = useState<MediaImageMetadata[]>([]);

    const userId = useAuth();

    const handleVideoSelected = (v: MediaVideoMetadata) => {
        setCurrVideoPlayingSrc(`/video?videoId=${v.assetId}&mode=historical`);
    };

    useEffect(() => {
        const fetchAssets = async () => {
            const assets = await client.listProjectAssets({ userId, projectId: project.id })
            setCurrProjectVideos(assets.videos)
            setCurrProjectImages(assets.images)
            setCurrProjectTexts(assets.textBoxes)
        }
        fetchAssets();
    }, [userId, project])

    return (
        <div className="flex flex-col items-center h-full">
            <h1> {project.name} </h1>
            <div className="flex flex-col w-2/3 h-full gap-4">
                <Card className="flex-[3]">
                    <CardContent>
                        {
                        currVideoPlayingSrc !== "" 
                            ? <VideoPlayer src={currVideoPlayingSrc} /> 
                            : <EmptyVideoPlayer />
                        }
                    </CardContent>
                </Card>
                <Card className="flex-[2]">
                    <CardContent >
                        {currProjectVideos.length > 0 &&
                        <Table<MediaVideoMetadata>
                            title="Videos"
                            data={currProjectVideos}
                            columns={[
                                { key: "title", header: "Title" },
                                { key: "duration", header: "Duration", render: (_value, row) => {
                                    const totalSeconds = Math.floor(row.duration)
                                    const hrs = Math.floor(totalSeconds / 3600)
                                    const mins = Math.floor((totalSeconds % 3600) / 60)
                                    const secs = totalSeconds % 60
                                    const pad = (n: number) => String(n).padStart(2, "0")
                                    return hrs > 0
                                        ? `${hrs}:${pad(mins)}:${pad(secs)}`
                                        : `${mins}:${pad(secs)}`
                                }}
                            ]}
                            onSelectRow={(v) => handleVideoSelected(v)}
                        />}
                        {currProjectTexts.length > 0 &&
                        <Table<MediaTextMetadata>
                            title="Images"
                            data={currProjectTexts}
                            columns={[
                                { key: "assetId", "header": "Asset ID" }
                            ]}
                            onSelectRow={() => {}}
                        />}
                        {currProjectImages.length > 0 &&
                        <Table<MediaImageMetadata>
                            title="Text Boxes"
                            data={currProjectImages}
                            columns={[
                                { key: "assetId", "header": "Asset ID" }
                            ]}
                            onSelectRow={() => {}}
                        />}
                    </CardContent>
                </Card>
                <Card className="flex-[1]">
                    <CardContent>
                            TODO: curr branch
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}