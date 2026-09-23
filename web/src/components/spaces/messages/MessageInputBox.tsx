import { ArrowUpIcon } from "@heroicons/react/24/outline";
import { EditorContent } from "@tiptap/react";
import { Button } from "../../ui/button";
import { cn } from "@/lib/utils";
import { MentionCard } from "./MentionCard";
import {
  type MessageInputCommand,
  type MessageInputValue,
  useMessageInputEditor,
} from "../hooks/useMessageInputEditor";

interface MessageInputBoxProps {
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  commands?: MessageInputCommand[];
  onSubmit?: (value: MessageInputValue) => void | Promise<void>;
}

export function MessageInputBox({
  className,
  placeholder = "Message this space...",
  disabled = false,
  commands,
  onSubmit,
}: MessageInputBoxProps) {
  const {
    editor,
    handleCommandSelect,
    handleKeyDown,
    handleMentionSelect,
    handleSubmit,
    isEmpty,
    submitting,
    visibleCommands,
    visibleMentions,
  } = useMessageInputEditor({
    commands,
    disabled,
    onSubmit,
  });

  return (
    <div
      className={cn(
        "relative rounded-md border bg-background shadow-xs",
        disabled && "opacity-60",
        className,
      )}
    >
      {visibleCommands.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          {visibleCommands.map((command) => (
            <Button
              key={command.id}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start rounded-none px-3 py-2 text-left"
              onMouseDown={(event) => {
                event.preventDefault();
                handleCommandSelect(command);
              }}
            >
              <span className="flex flex-col gap-1">
                <span>{command.label}</span>
                {command.description && (
                  <span className="text-muted-foreground">
                    {command.description}
                  </span>
                )}
              </span>
            </Button>
          ))}
        </div>
      )}
      {visibleMentions.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          {visibleMentions.map((mention) => (
            <Button
              key={mention.id}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start rounded-none px-3 py-2 text-left"
              onMouseDown={(event) => {
                event.preventDefault();
                handleMentionSelect(mention);
              }}
            >
              <MentionCard
                mention={mention}
                className="border-0 bg-transparent p-0 shadow-none"
              />
            </Button>
          ))}
        </div>
      )}
      <div className="relative" onKeyDown={handleKeyDown}>
        {isEmpty && (
          <span className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
      <div className="flex items-center justify-end border-t px-2 py-2">
        <Button
          type="button"
          size="icon-sm"
          disabled={disabled || submitting || isEmpty}
          onClick={() => void handleSubmit()}
          aria-label="Send message"
        >
          <ArrowUpIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
