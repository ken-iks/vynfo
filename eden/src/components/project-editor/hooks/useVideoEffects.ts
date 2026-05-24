import { useEffect } from "react";
import { useSnapshot } from "valtio";
import { editorStore } from "../../stores/editor";
import { videoRuntime } from "../../stores/videoRuntime";
import { pixiFilterForVideoEffect } from "../videoEffectDefinitions";

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
      const filter = pixiFilterForVideoEffect(effect);
      return filter ? [filter] : [];
    });

    sprite.filters = filters;
  }, [snap.playbackTimeMillis, snap.sections, spriteVersion]);
}
