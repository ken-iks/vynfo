import type { MediaVideoEffect } from "@/gen/proto/v1/projects_pb";
import { BlurFilter, ColorMatrixFilter } from "pixi.js";

export type VideoEffectKind = "blur" | "sepia" | "saturation" | "brightness";

export type LeveledVideoEffectKind = Exclude<VideoEffectKind, "sepia">;

type PixiVideoFilter = BlurFilter | ColorMatrixFilter;

interface RendererMapping {
  name: string;
  parameter: string;
}

interface LeveledVideoEffectDefinition {
  kind: LeveledVideoEffectKind;
  label: string;
  controlLabel: string;
  defaultLevel: number;
  ffmpeg: RendererMapping & {
    valuesByLevel: number[];
  };
  pixi: RendererMapping & {
    createFilter: (ffmpegValue: number) => PixiVideoFilter;
  };
}

interface StaticVideoEffectDefinition {
  kind: "sepia";
  label: string;
  description: string;
  ffmpeg: RendererMapping;
  pixi: RendererMapping & {
    createFilter: () => PixiVideoFilter;
  };
}

export type VideoEffectDefinition =
  | LeveledVideoEffectDefinition
  | StaticVideoEffectDefinition;

export const VIDEO_EFFECT_KINDS: VideoEffectKind[] = [
  "blur",
  "sepia",
  "saturation",
  "brightness",
];

const BLUR_VALUES_BY_LEVEL = [0.5, 1, 1.5, 2, 3, 4, 5.5, 7, 8.5, 10];
const SATURATION_VALUES_BY_LEVEL = [
  0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5,
];
const BRIGHTNESS_VALUES_BY_LEVEL = [
  -0.3, -0.22, -0.15, -0.08, 0, 0.06, 0.12, 0.2, 0.3, 0.4,
];

const BLUR_DEFINITION: LeveledVideoEffectDefinition = {
  kind: "blur",
  label: "Blur",
  controlLabel: "Amount",
  defaultLevel: 6,
  ffmpeg: {
    name: "gblur",
    parameter: "sigma",
    valuesByLevel: BLUR_VALUES_BY_LEVEL,
  },
  pixi: {
    name: "BlurFilter",
    parameter: "strength",
    createFilter: (ffmpegValue) =>
      new BlurFilter({ strength: Math.max(1, ffmpegValue * 2) }),
  },
};

const SEPIA_DEFINITION: StaticVideoEffectDefinition = {
  kind: "sepia",
  label: "Sepia",
  description: "Default warm vintage tone.",
  ffmpeg: {
    name: "colorchannelmixer",
    parameter: "sepia matrix",
  },
  pixi: {
    name: "ColorMatrixFilter",
    parameter: "sepia",
    createFilter: () => {
      const filter = new ColorMatrixFilter();
      filter.sepia(false);
      return filter;
    },
  },
};

const SATURATION_DEFINITION: LeveledVideoEffectDefinition = {
  kind: "saturation",
  label: "Saturation",
  controlLabel: "Amount",
  defaultLevel: 7,
  ffmpeg: {
    name: "eq",
    parameter: "saturation",
    valuesByLevel: SATURATION_VALUES_BY_LEVEL,
  },
  pixi: {
    name: "ColorMatrixFilter",
    parameter: "saturate",
    createFilter: (ffmpegValue) => {
      const filter = new ColorMatrixFilter();
      filter.saturate(Math.min(1, Math.max(-1, ffmpegValue - 1)), false);
      return filter;
    },
  },
};

const BRIGHTNESS_DEFINITION: LeveledVideoEffectDefinition = {
  kind: "brightness",
  label: "Brightness",
  controlLabel: "Amount",
  defaultLevel: 7,
  ffmpeg: {
    name: "eq",
    parameter: "brightness",
    valuesByLevel: BRIGHTNESS_VALUES_BY_LEVEL,
  },
  pixi: {
    name: "ColorMatrixFilter",
    parameter: "brightness",
    createFilter: (ffmpegValue) => {
      const filter = new ColorMatrixFilter();
      filter.brightness(Math.max(0, 1 + ffmpegValue), false);
      return filter;
    },
  },
};

export function getVideoEffectDefinition(
  kind: VideoEffectKind,
): VideoEffectDefinition {
  switch (kind) {
    case "blur":
      return BLUR_DEFINITION;
    case "sepia":
      return SEPIA_DEFINITION;
    case "saturation":
      return SATURATION_DEFINITION;
    case "brightness":
      return BRIGHTNESS_DEFINITION;
  }
}

export function isLeveledVideoEffectKind(
  kind: VideoEffectKind,
): kind is LeveledVideoEffectKind {
  return kind !== "sepia";
}

function getLeveledVideoEffectDefinition(
  kind: LeveledVideoEffectKind,
): LeveledVideoEffectDefinition {
  switch (kind) {
    case "blur":
      return BLUR_DEFINITION;
    case "saturation":
      return SATURATION_DEFINITION;
    case "brightness":
      return BRIGHTNESS_DEFINITION;
  }
}

function clampLevel(level: number) {
  return Math.min(10, Math.max(1, Math.round(level)));
}

export function defaultLevelForVideoEffect(kind: LeveledVideoEffectKind) {
  return getLeveledVideoEffectDefinition(kind).defaultLevel;
}

export function valueForVideoEffectLevel(
  kind: LeveledVideoEffectKind,
  level: number,
) {
  const definition = getLeveledVideoEffectDefinition(kind);
  const clampedLevel = clampLevel(level);
  const value = definition.ffmpeg.valuesByLevel[clampedLevel - 1];
  return (
    value ?? definition.ffmpeg.valuesByLevel[definition.defaultLevel - 1] ?? 0
  );
}

export function levelForVideoEffectValue(
  kind: LeveledVideoEffectKind,
  value: number,
) {
  const definition = getLeveledVideoEffectDefinition(kind);
  let nearestLevel = definition.defaultLevel;
  let nearestDistance = Number.POSITIVE_INFINITY;

  definition.ffmpeg.valuesByLevel.forEach((levelValue, index) => {
    const distance = Math.abs(levelValue - value);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestLevel = index + 1;
    }
  });

  return nearestLevel;
}

export function pixiFilterForVideoEffect(effect: MediaVideoEffect) {
  switch (effect.effect.case) {
    case "blur": {
      const value =
        effect.effect.value.intensity ||
        valueForVideoEffectLevel("blur", defaultLevelForVideoEffect("blur"));
      return BLUR_DEFINITION.pixi.createFilter(value);
    }
    case "sepia":
      return SEPIA_DEFINITION.pixi.createFilter();
    case "saturation":
      return SATURATION_DEFINITION.pixi.createFilter(
        effect.effect.value.strength,
      );
    case "brightness":
      return BRIGHTNESS_DEFINITION.pixi.createFilter(
        effect.effect.value.strength,
      );
    case undefined:
      return null;
  }
}
