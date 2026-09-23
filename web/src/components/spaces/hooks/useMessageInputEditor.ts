import { type Editor, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { MessageMention } from "../messages/MentionCard";
import { useMentionUsers } from "./useMentionUsers";

export interface MessageInputValue {
  text: string;
  html: string;
  json: JSONContent;
}

export interface MessageInputCommandRange {
  from: number;
  to: number;
}

export interface MessageInputCommandContext {
  editor: Editor;
  query: string;
  range: MessageInputCommandRange;
}

export interface MessageInputCommand {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  run: (context: MessageInputCommandContext) => void;
}

export type MessageInputMention = MessageMention;

interface TriggerMatch {
  query: string;
  range: MessageInputCommandRange;
}

interface UseMessageInputEditorOptions {
  disabled?: boolean;
  commands?: MessageInputCommand[];
  onSubmit?: (value: MessageInputValue) => void | Promise<void>;
}

const defaultCommands: MessageInputCommand[] = [];

function getTriggerMatch(editor: Editor, trigger: string): TriggerMatch | null {
  const { from } = editor.state.selection;
  const start = Math.max(0, from - 80);
  const textBeforeCursor = editor.state.doc.textBetween(
    start,
    from,
    "\n",
    "\n",
  );
  const triggerIndex = textBeforeCursor.lastIndexOf(trigger);

  if (triggerIndex === -1) return null;

  const query = textBeforeCursor.slice(triggerIndex + 1);
  if (query.includes(" ") || query.includes("\n")) return null;

  const rangeFrom = from - (textBeforeCursor.length - triggerIndex);
  return {
    query,
    range: {
      from: rangeFrom,
      to: from,
    },
  };
}

function commandMatchesQuery(command: MessageInputCommand, query: string) {
  const normalizedQuery = query.toLowerCase();
  const labelMatches = command.label.toLowerCase().includes(normalizedQuery);
  const keywordMatches = command.keywords?.some((keyword) =>
    keyword.toLowerCase().includes(normalizedQuery),
  );

  return labelMatches || keywordMatches === true;
}

function mentionMatchesQuery(mention: MessageInputMention, query: string) {
  return mention.label.toLowerCase().includes(query.toLowerCase());
}

export function useMessageInputEditor({
  disabled = false,
  commands = defaultCommands,
  onSubmit,
}: UseMessageInputEditorOptions) {
  const [isEmpty, setIsEmpty] = useState(true);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        gapcursor: false,
      }),
    ],
    [],
  );
  const mentions = useMentionUsers();

  const syncEditorState = ({ editor }: { editor: Editor }) => {
    setIsEmpty(editor.isEmpty);
    setSlashQuery(getTriggerMatch(editor, "/")?.query ?? null);
    setMentionQuery(getTriggerMatch(editor, "@")?.query ?? null);
  };

  const editor = useEditor({
    extensions,
    content: "",
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn("min-h-20 px-3 py-3", "text-sm outline-none", "[&_p]:my-0"),
      },
    },
    onCreate: syncEditorState,
    onUpdate: syncEditorState,
    onSelectionUpdate: syncEditorState,
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const visibleCommands = useMemo(() => {
    if (slashQuery === null) return [];
    return commands.filter((command) =>
      commandMatchesQuery(command, slashQuery),
    );
  }, [commands, slashQuery]);

  const visibleMentions = useMemo(() => {
    if (mentionQuery === null) return [];
    return mentions.filter((mention) =>
      mentionMatchesQuery(mention, mentionQuery),
    );
  }, [mentionQuery, mentions]);

  const handleCommandSelect = (command: MessageInputCommand) => {
    if (!editor) return;
    const match = getTriggerMatch(editor, "/");
    if (!match) return;

    command.run({
      editor,
      query: match.query,
      range: match.range,
    });
    editor.commands.focus();
    setSlashQuery(null);
  };

  const handleMentionSelect = (mention: MessageInputMention) => {
    if (!editor) return;
    const match = getTriggerMatch(editor, "@");
    if (!match) return;

    editor
      .chain()
      .focus()
      .insertContentAt(match.range, `@${mention.label} `)
      .run();
    setMentionQuery(null);
  };

  const handleSubmit = async () => {
    if (!editor || disabled || submitting) return;

    const text = editor.getText().trim();
    if (!text) return;

    setSubmitting(true);
    try {
      await onSubmit?.({
        text,
        html: editor.getHTML(),
        json: editor.getJSON(),
      });
    } catch {
      return;
    } finally {
      setSubmitting(false);
    }

    editor.commands.clearContent();
    setIsEmpty(true);
    setSlashQuery(null);
    setMentionQuery(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    void handleSubmit();
  };

  return {
    editor,
    handleCommandSelect,
    handleKeyDown,
    handleMentionSelect,
    handleSubmit,
    isEmpty,
    submitting,
    visibleCommands,
    visibleMentions,
  };
}
