import type {
  MediaAudioMetadata,
  MediaImageMetadata,
  MediaVideoMetadata,
} from "@/gen/proto/v1/projects_pb";
import type { DirectoryMetadata } from "@/gen/proto/v1/vfs_pb";

export type VfsAssetKind = "video" | "image" | "audio";

export type VfsDirectoryEntry = {
  entryType: "directory";
  id: string;
  name: string;
  directory: DirectoryMetadata;
};

export type VfsAssetEntry = {
  entryType: "asset";
  kind: VfsAssetKind;
  id: string;
  name: string;
  video?: MediaVideoMetadata;
  image?: MediaImageMetadata;
  audio?: MediaAudioMetadata;
};

export type VfsEntry = VfsDirectoryEntry | VfsAssetEntry;

export type VfsDirectorySnapshot = {
  directories: DirectoryMetadata[];
  videos: MediaVideoMetadata[];
  images: MediaImageMetadata[];
  audios: MediaAudioMetadata[];
};

export type VfsPathSegment = {
  id: string;
  name: string;
};

export type VfsTreeRow = {
  entry: VfsEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
};

export const rootDirectoryKey = "root";

export function directoryKey(directoryId: string | undefined) {
  return directoryId ?? rootDirectoryKey;
}

export function snapshotEntries(snapshot: VfsDirectorySnapshot): VfsEntry[] {
  return [
    ...snapshot.directories.map(
      (directory): VfsDirectoryEntry => ({
        entryType: "directory",
        id: directory.id,
        name: directory.name,
        directory,
      }),
    ),
    ...snapshot.videos.map(
      (video): VfsAssetEntry => ({
        entryType: "asset",
        kind: "video",
        id: video.assetId,
        name: video.title,
        video,
      }),
    ),
    ...snapshot.images.map(
      (image): VfsAssetEntry => ({
        entryType: "asset",
        kind: "image",
        id: image.assetId,
        name: image.title,
        image,
      }),
    ),
    ...snapshot.audios.map(
      (audio): VfsAssetEntry => ({
        entryType: "asset",
        kind: "audio",
        id: audio.assetId,
        name: audio.title,
        audio,
      }),
    ),
  ];
}

export function snapshotAssetIds(snapshot: VfsDirectorySnapshot) {
  return [
    ...snapshot.videos.map((video) => video.assetId),
    ...snapshot.images.map((image) => image.assetId),
    ...snapshot.audios.map((audio) => audio.assetId),
  ];
}
