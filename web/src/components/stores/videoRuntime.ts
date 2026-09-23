import type { Application, Sprite } from "pixi.js";

// VideoRuntime is a singleton pixi sprite that handles runtime
// for the video playback editor. We use the video runtime to
// apply filters to the video
class VideoRuntime {
  app: Application | null = null;
  videoSprite: Sprite | null = null;
  video: HTMLVideoElement | null = null;

  setVideo(video: HTMLVideoElement) {
    this.video = video;
  }

  clearVideo(video: HTMLVideoElement) {
    if (this.video !== video) return;

    this.video = null;
  }

  setPixi(app: Application, videoSprite: Sprite) {
    this.app = app;
    this.videoSprite = videoSprite;
  }

  clearPixi(app: Application) {
    if (this.app !== app) return;

    this.app = null;
    this.videoSprite = null;
  }

  seekToMillis(ms: bigint) {
    if (!this.video) return;

    this.video.currentTime = Number(ms) / 1000;
  }
}

export const videoRuntime = new VideoRuntime();
