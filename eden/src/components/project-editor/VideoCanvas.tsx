import { useEffect, useRef, useState } from "react";
import { Application, Sprite, Texture } from "pixi.js";
import { videoRuntime } from "../stores/videoRuntime";
import { useVideoEffects } from "./hooks/useVideoEffects";

export function VideoCanvas({ video }: { video: HTMLVideoElement | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spriteVersion, setSpriteVersion] = useState(0);
  useVideoEffects(spriteVersion);

  useEffect(() => {
    if (!video) return;

    videoRuntime.setVideo(video);
    return () => videoRuntime.clearVideo(video);
  }, [video]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;

    let cancelled = false;
    let initialized = false;
    const app = new Application();
    let sprite: Sprite | null = null;
    let observer: ResizeObserver | null = null;
    let removeReadyListener = () => {};

    // Match the Pixi canvas to the hidden source video's rendered box.
    const measure = () => {
      const rect = video.getBoundingClientRect();
      return {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      };
    };

    const applySize = (width: number, height: number) => {
      app.renderer.resize(width, height);
      if (sprite) {
        sprite.width = width;
        sprite.height = height;
      }
    };

    // Pixi v8 initializes asynchronously, so cleanup may happen before init completes.
    let cleanup = () => {
      removeReadyListener();
      observer?.disconnect();
      if (initialized) {
        app.destroy(undefined, { children: true });
      }
    };

    const start = async () => {
      const initial = measure();

      await app.init({
        canvas,
        width: initial.width,
        height: initial.height,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      initialized = true;
      if (cancelled) {
        app.destroy(undefined, { children: true });
        return;
      }

      // Do not create the video texture at metadata time. Waiting for a real
      // playable frame lets hls.js/browser playback finish its startup path first.
      const buildSprite = () => {
        if (sprite) return;
        sprite = new Sprite(Texture.from(video));
        const { width, height } = measure();
        sprite.width = width;
        sprite.height = height;
        app.stage.addChild(sprite);
        videoRuntime.setPixi(app, sprite);
        // we add a state counter to force the canvas to rerender after the sprite is created
        // this is so that the useVideoEffects hook can use it
        setSpriteVersion((version) => version + 1);
        applySize(width, height);
      };

      if (video.readyState >= video.HAVE_FUTURE_DATA) {
        buildSprite();
      } else if (video.requestVideoFrameCallback) {
        const handle = video.requestVideoFrameCallback(() => {
          buildSprite();
        });
        removeReadyListener = () => {
          video.cancelVideoFrameCallback(handle);
        };
      } else {
        video.addEventListener("canplay", buildSprite, { once: true });
        removeReadyListener = () => {
          video.removeEventListener("canplay", buildSprite);
        };
      }

      // Keep the canvas overlaid on the same layout size as the source video.
      observer = new ResizeObserver(() => {
        const { width, height } = measure();
        applySize(width, height);
      });
      observer.observe(video);
    };

    start();

    return () => {
      cancelled = true;
      videoRuntime.clearPixi(app);
      cleanup();
    };
  }, [video]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        inset: 0,
        position: "absolute",
      }}
    />
  );
}
