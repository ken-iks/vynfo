import { proxy } from "valtio";

class MediaAssetStore {
  imageUrls: Record<string, string> = {};
  textMarkdown: Record<string, string> = {};

  setImageUrl(assetId: string, url: string) {
    this.imageUrls[assetId] = url;
  }

  setTextMarkdown(assetId: string, markdown: string) {
    this.textMarkdown[assetId] = markdown;
  }
}

export const mediaAssetStore = proxy(new MediaAssetStore());
