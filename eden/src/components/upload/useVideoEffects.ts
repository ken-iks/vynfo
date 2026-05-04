import { useEffect } from "react";
import { useSnapshot } from "valtio";
import type { MediaVideoEffect } from "@/gen/proto/v1/projects_pb";
import { BlurFilter, ColorMatrixFilter } from "pixi.js";
import { editorStore } from "../stores/editor";
import { videoRuntime } from "../stores/videoRuntime";

function effectToFilter(effect: MediaVideoEffect) {
  switch (effect.effect.case) {
    case "blur":
      return new BlurFilter({ strength: effect.effect.value.intensity || 8 });
    case "sepia": {
      const filter = new ColorMatrixFilter();
      filter.sepia(false);
      return filter;
    }
    case "saturation": {
      const filter = new ColorMatrixFilter();
      filter.saturate(effect.effect.value.strength, false);
      return filter;
    }
    case "brightness": {
      const filter = new ColorMatrixFilter();
      filter.brightness(effect.effect.value.strength || 1, false);
      return filter;
    }
    case undefined:
      return null;
  }
}

export function useVideoEffects(spriteVersion: number) {
  const snap = useSnapshot(editorStore);

  useEffect(() => {
    const sprite = videoRuntime.videoSprite;
    if (!sprite) return;

    const activeSection = editorStore.sections.find(
      (section) =>
        section.startTimeMillis <= snap.playbackTimeMillis &&
        snap.playbackTimeMillis < section.endTimeMillis,
    );
    const effects = activeSection?.video?.effects ?? [];
    const filters = effects.flatMap((effect) => {
      const filter = effectToFilter(effect);
      return filter ? [filter] : [];
    });

    sprite.filters = filters;
  }, [snap.playbackTimeMillis, snap.sections, spriteVersion]);
}
