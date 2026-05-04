import { proxy } from "valtio";

class MediaAssetStore {
  imageUrls: Record<string, string> = {};

  setImageUrl(assetId: string, url: string) {
    this.imageUrls[assetId] = url;
  }
}

export const mediaAssetStore = proxy(new MediaAssetStore());
