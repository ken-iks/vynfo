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

type DraftEffect =
  | { id: number; kind: "blur"; intensity: number }
  | { id: number; kind: "sepia" }
  | { id: number; kind: "saturation"; strength: number }
  | { id: number; kind: "brightness"; strength: number };

interface EffectsComposerProps {
  open: boolean;
  sectionIndex: number | null;
  onOpenChange: (open: boolean) => void;
}

function effectLabel(effect: DraftEffect) {
  switch (effect.kind) {
    case "blur":
      return "Blur";
    case "sepia":
      return "Sepia";
    case "saturation":
      return "Saturation";
    case "brightness":
      return "Brightness";
  }
}

function protoEffectToDraft(effect: MediaVideoEffect, id: number): DraftEffect {
  switch (effect.effect.case) {
    case "blur":
      return {
        id,
        kind: "blur",
        intensity: effect.effect.value.intensity || 8,
      };
    case "sepia":
      return { id, kind: "sepia" };
    case "saturation":
      return {
        id,
        kind: "saturation",
        strength: effect.effect.value.strength,
      };
    case "brightness":
      return {
        id,
        kind: "brightness",
        strength: effect.effect.value.strength || 1,
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
          value: create(BlurEffectSchema, { intensity: effect.intensity }),
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
          value: create(SaturationEffectSchema, { strength: effect.strength }),
        },
      });
    case "brightness":
      return create(MediaVideoEffectSchema, {
        effect: {
          case: "brightness",
          value: create(BrightnessEffectSchema, { strength: effect.strength }),
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

  const addEffect = (kind: DraftEffect["kind"]) => {
    const id = nextId.current;
    nextId.current += 1;

    switch (kind) {
      case "blur":
        setDraftEffects((effects) => [
          ...effects,
          { id, kind: "blur", intensity: 8 },
        ]);
        return;
      case "sepia":
        setDraftEffects((effects) => [...effects, { id, kind: "sepia" }]);
        return;
      case "saturation":
        setDraftEffects((effects) => [
          ...effects,
          { id, kind: "saturation", strength: -1 },
        ]);
        return;
      case "brightness":
        setDraftEffects((effects) => [
          ...effects,
          { id, kind: "brightness", strength: 1.2 },
        ]);
        return;
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

  const updateBlurIntensity = (index: number, value: number[]) => {
    const intensity = value[0] ?? 8;
    setDraftEffects((effects) =>
      effects.map((effect, i) => {
        if (i !== index || effect.kind !== "blur") return effect;
        return { ...effect, intensity };
      }),
    );
  };

  const updateSaturationStrength = (index: number, value: number[]) => {
    const strength = value[0] ?? 0;
    setDraftEffects((effects) =>
      effects.map((effect, i) => {
        if (i !== index || effect.kind !== "saturation") return effect;
        return { ...effect, strength };
      }),
    );
  };

  const updateBrightnessStrength = (index: number, value: number[]) => {
    const strength = value[0] ?? 1;
    setDraftEffects((effects) =>
      effects.map((effect, i) => {
        if (i !== index || effect.kind !== "brightness") return effect;
        return { ...effect, strength };
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
    switch (effect.kind) {
      case "blur":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Intensity</span>
              <span className="tabular-nums">
                {effect.intensity.toFixed(1)}
              </span>
            </div>
            <Slider
              min={1}
              max={20}
              step={0.5}
              value={[effect.intensity]}
              onValueChange={(value) => updateBlurIntensity(index, value)}
            />
          </div>
        );
      case "sepia":
        return (
          <p className="text-muted-foreground">Default warm vintage tone.</p>
        );
      case "saturation":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Strength</span>
              <span className="tabular-nums">{effect.strength.toFixed(2)}</span>
            </div>
            <Slider
              min={-1}
              max={1}
              step={0.05}
              value={[effect.strength]}
              onValueChange={(value) => updateSaturationStrength(index, value)}
            />
          </div>
        );
      case "brightness":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Strength</span>
              <span className="tabular-nums">{effect.strength.toFixed(2)}</span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[effect.strength]}
              onValueChange={(value) => updateBrightnessStrength(index, value)}
            />
          </div>
        );
    }
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
          <Button
            type="button"
            variant="outline"
            onClick={() => addEffect("blur")}
          >
            Add blur
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => addEffect("sepia")}
          >
            Add sepia
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => addEffect("saturation")}
          >
            Add saturation
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => addEffect("brightness")}
          >
            Add brightness
          </Button>
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
                    <div className="font-medium">{effectLabel(effect)}</div>
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
