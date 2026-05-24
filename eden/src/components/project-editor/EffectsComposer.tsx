import { create } from "@bufbuild/protobuf";
import type { MediaVideoEffect } from "@/gen/proto/v1/projects_pb";
import {
  BlurEffectSchema,
  BrightnessEffectSchema,
  MediaVideoEffectSchema,
  SaturationEffectSchema,
  SepiaEffectSchema,
} from "@/gen/proto/v1/projects_pb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { editorStore } from "../stores/editor";
import { useEffect, useRef, useState } from "react";
import {
  defaultLevelForVideoEffect,
  getVideoEffectDefinition,
  isLeveledVideoEffectKind,
  levelForVideoEffectValue,
  type LeveledVideoEffectKind,
  type VideoEffectKind,
  valueForVideoEffectLevel,
  VIDEO_EFFECT_KINDS,
} from "./videoEffectDefinitions";

type DraftEffect =
  | { id: number; kind: LeveledVideoEffectKind; level: number }
  | { id: number; kind: "sepia" };

interface EffectsComposerProps {
  open: boolean;
  sectionIndex: number | null;
  onOpenChange: (open: boolean) => void;
}

function effectLabel(kind: VideoEffectKind) {
  return getVideoEffectDefinition(kind).label;
}

function protoEffectToDraft(effect: MediaVideoEffect, id: number): DraftEffect {
  switch (effect.effect.case) {
    case "blur":
      return {
        id,
        kind: "blur",
        level: levelForVideoEffectValue(
          "blur",
          effect.effect.value.intensity ||
            valueForVideoEffectLevel(
              "blur",
              defaultLevelForVideoEffect("blur"),
            ),
        ),
      };
    case "sepia":
      return { id, kind: "sepia" };
    case "saturation":
      return {
        id,
        kind: "saturation",
        level: levelForVideoEffectValue(
          "saturation",
          effect.effect.value.strength,
        ),
      };
    case "brightness":
      return {
        id,
        kind: "brightness",
        level: levelForVideoEffectValue(
          "brightness",
          effect.effect.value.strength,
        ),
      };
    case undefined:
      return { id, kind: "sepia" };
  }
}

function draftEffectToProto(effect: DraftEffect): MediaVideoEffect {
  switch (effect.kind) {
    case "blur":
      return create(MediaVideoEffectSchema, {
        effect: {
          case: "blur",
          value: create(BlurEffectSchema, {
            intensity: valueForVideoEffectLevel("blur", effect.level),
          }),
        },
      });
    case "sepia":
      return create(MediaVideoEffectSchema, {
        effect: {
          case: "sepia",
          value: create(SepiaEffectSchema),
        },
      });
    case "saturation":
      return create(MediaVideoEffectSchema, {
        effect: {
          case: "saturation",
          value: create(SaturationEffectSchema, {
            strength: valueForVideoEffectLevel("saturation", effect.level),
          }),
        },
      });
    case "brightness":
      return create(MediaVideoEffectSchema, {
        effect: {
          case: "brightness",
          value: create(BrightnessEffectSchema, {
            strength: valueForVideoEffectLevel("brightness", effect.level),
          }),
        },
      });
  }
}

export function EffectsComposer({
  open,
  sectionIndex,
  onOpenChange,
}: EffectsComposerProps) {
  const nextId = useRef(1);
  const [draftEffects, setDraftEffects] = useState<DraftEffect[]>([]);

  useEffect(() => {
    if (!open || sectionIndex === null) return;

    const section = editorStore.sections[sectionIndex];
    const effects = section?.video?.effects ?? [];
    const nextEffects = effects.map((effect) => {
      const id = nextId.current;
      nextId.current += 1;
      return protoEffectToDraft(effect, id);
    });
    setDraftEffects(nextEffects);
  }, [open, sectionIndex]);

  const addEffect = (kind: VideoEffectKind) => {
    const id = nextId.current;
    nextId.current += 1;

    if (isLeveledVideoEffectKind(kind)) {
      setDraftEffects((effects) => [
        ...effects,
        { id, kind, level: defaultLevelForVideoEffect(kind) },
      ]);
    } else {
      setDraftEffects((effects) => [...effects, { id, kind }]);
    }
  };

  const removeEffect = (index: number) => {
    setDraftEffects((effects) => effects.filter((_, i) => i !== index));
  };

  const moveEffect = (index: number, direction: -1 | 1) => {
    setDraftEffects((effects) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= effects.length) return effects;

      const nextEffects = effects.slice();
      const current = nextEffects[index];
      const target = nextEffects[targetIndex];
      if (!current || !target) return effects;

      nextEffects[index] = target;
      nextEffects[targetIndex] = current;
      return nextEffects;
    });
  };

  const updateEffectLevel = (index: number, value: number[]) => {
    const level = value[0] ?? 1;
    setDraftEffects((effects) =>
      effects.map((effect, i) => {
        if (i !== index || effect.kind === "sepia") return effect;
        return { ...effect, level };
      }),
    );
  };

  const applyEffects = () => {
    if (sectionIndex === null) return;

    editorStore.setSectionVideoEffects(
      sectionIndex,
      draftEffects.map(draftEffectToProto),
    );
    onOpenChange(false);
  };

  const renderEffectControls = (effect: DraftEffect, index: number) => {
    const definition = getVideoEffectDefinition(effect.kind);

    if (effect.kind === "sepia" || definition.kind === "sepia") {
      const sepiaDefinition = getVideoEffectDefinition("sepia");
      if (sepiaDefinition.kind === "sepia") {
        return (
          <p className="text-muted-foreground">{sepiaDefinition.description}</p>
        );
      }
      return null;
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>{definition.controlLabel}</span>
          <span className="tabular-nums">Level {effect.level}</span>
        </div>
        <Slider
          min={1}
          max={10}
          step={1}
          value={[effect.level]}
          onValueChange={(value) => updateEffectLevel(index, value)}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Effects Composer</DialogTitle>
          <DialogDescription>
            Compose filters for the selected timeline section.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {VIDEO_EFFECT_KINDS.map((kind) => (
            <Button
              key={kind}
              type="button"
              variant="outline"
              onClick={() => addEffect(kind)}
            >
              Add {effectLabel(kind).toLowerCase()}
            </Button>
          ))}
        </div>

        <div className="max-h-96 space-y-3 overflow-y-auto">
          {draftEffects.length === 0 ? (
            <div className="border border-dashed p-4 text-center text-muted-foreground">
              No effects yet.
            </div>
          ) : (
            draftEffects.map((effect, index) => (
              <div key={effect.id} className="space-y-3 border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {effectLabel(effect.kind)}
                    </div>
                    <div className="text-muted-foreground">
                      Layer {index + 1} of {draftEffects.length}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={index === 0}
                      onClick={() => moveEffect(index, -1)}
                    >
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={index === draftEffects.length - 1}
                      onClick={() => moveEffect(index, 1)}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="xs"
                      onClick={() => removeEffect(index)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                {renderEffectControls(effect, index)}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={applyEffects}
            disabled={sectionIndex === null}
          >
            Apply effects
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
