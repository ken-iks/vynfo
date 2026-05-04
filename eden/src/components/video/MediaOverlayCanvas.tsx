import type { PointerEvent as ReactPointerEvent } from "react";
import Markdown from "react-markdown";
import { useSnapshot } from "valtio";
import { cn } from "@/lib/utils";
import { editorStore } from "../stores/editor";
import { mediaAssetStore } from "../stores/mediaAssets";

const DEFAULT_OVERLAY_SIZE = 160n;

export function MediaOverlayCanvas() {
  const snap = useSnapshot(editorStore);
  const assetSnap = useSnapshot(mediaAssetStore);
  const activeSectionIndex = snap.sections.findIndex(
    (section) =>
      section.startTimeMillis <= snap.playbackTimeMillis &&
      snap.playbackTimeMillis < section.endTimeMillis,
  );
  const activeSection =
    activeSectionIndex >= 0 ? snap.sections[activeSectionIndex] : undefined;

  if (!activeSection) return null;

  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      {activeSection.overlays.map((overlay, overlayIndex) => {
        const position =
          overlay.kind.case === "image" || overlay.kind.case === "text"
            ? overlay.kind.value.pos
            : undefined;
        const size = position?.size ?? DEFAULT_OVERLAY_SIZE;
        const leftPx = Number(position?.leftCornerPx ?? 32n);
        const topPx = Number(position?.leftCornerPy ?? 32n);
        const sizePx = Number(size);
        const imageUrl =
          overlay.kind.case === "image"
            ? (assetSnap.imageUrls[overlay.kind.value.assetId] ?? "")
            : "";
        const markdown =
          overlay.kind.case === "text" ? overlay.kind.value.content : "";
        const isSelected =
          snap.selectedOverlay?.sectionIndex === activeSectionIndex &&
          snap.selectedOverlay.overlayIndex === overlayIndex;

        const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          editorStore.selectOverlay(activeSectionIndex, overlayIndex);

          const startClientX = e.clientX;
          const startClientY = e.clientY;

          const onMove = (ev: PointerEvent) => {
            editorStore.updateOverlayPosition(
              activeSectionIndex,
              overlayIndex,
              leftPx + ev.clientX - startClientX,
              topPx + ev.clientY - startClientY,
              size,
            );
          };
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
          };

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          window.addEventListener("pointercancel", onUp);
        };

        return (
          <div
            key={`${overlay.kind.case}-${overlayIndex}`}
            className={cn(
              "absolute cursor-move select-none overflow-hidden rounded-sm",
              "border border-white/40 bg-black/35 shadow-sm backdrop-blur-[1px]",
              isSelected && "ring-2 ring-primary",
            )}
            style={{
              left: leftPx,
              top: topPx,
              width: sizePx,
              height: overlay.kind.case === "text" ? undefined : sizePx,
            }}
            onPointerDown={handlePointerDown}
          >
            {overlay.kind.case === "image" ? (
              <img
                src={imageUrl}
                alt=""
                className="block size-full object-contain"
                draggable={false}
              />
            ) : overlay.kind.case === "text" ? (
              <div
                className={cn(
                  "p-2 text-xs font-medium",
                  overlay.kind.value.color === 1 ? "text-black" : "text-white",
                )}
              >
                {markdown ? <Markdown>{markdown}</Markdown> : "Markdown text"}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
