import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRef, useState } from "react";

interface DragUploadAreaProps {
  onFileSelected: (f: File) => void;
  selectedFile: File | null;
  accept: string;
  label: string;
  isAcceptedFile: (file: File) => boolean;
}

export function DragUploadArea({
  onFileSelected,
  selectedFile,
  accept,
  label,
  isAcceptedFile,
}: DragUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = isDragging || isHovering;

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && isAcceptedFile(file)) onFileSelected(file);
      }}
      className={clsx(
        "flex flex-col items-center justify-center gap-2",
        "rounded-lg border-2 border-dashed p-8 min-h-[150px]",
        "cursor-pointer transition-all duration-200",
        active
          ? "border-primary bg-primary/20 scale-[1.01]"
          : "border-base-content/20",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && isAcceptedFile(file)) onFileSelected(file);
        }}
      />
      <ArrowUpTrayIcon
        className={clsx(
          "size-8 transition-colors duration-200",
          active ? "text-primary" : "text-base-content/50",
        )}
      />
      {selectedFile ? (
        <p className="text-sm text-base-content/70">{selectedFile.name}</p>
      ) : (
        <p
          className={clsx(
            "text-lg font-semibold transition-colors duration-200",
            active ? "text-primary" : "text-base-content/50",
          )}
        >
          {label}
        </p>
      )}
    </div>
  );
}
