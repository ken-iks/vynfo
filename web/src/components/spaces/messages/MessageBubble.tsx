import type { ReactNode } from "react";
import type { SpaceMessageWithMetadata } from "@/gen/proto/v1/spaces_pb";
import { Card, CardContent } from "../../ui/card";
import { cn } from "@/lib/utils";
import { MentionCard, type MessageMention } from "./MentionCard";
import { useMentionUsers } from "../hooks/useMentionUsers";
import { formatTimestampTime } from "@/utils/timestamp-conversaions";

export type MessageBubbleTone = "user" | "nonUser" | "agent";

interface MessageBubbleProps {
  message: SpaceMessageWithMetadata;
  authorNameOverride?: string;
  tone: MessageBubbleTone;
}

interface MentionMatch {
  mention: MessageMention;
  index: number;
  token: string;
}

function findNextMention(
  content: string,
  mentions: MessageMention[],
  start: number,
): MentionMatch | null {
  let nextMention: MessageMention | undefined;
  let nextIndex = -1;
  let nextToken = "";

  for (const mention of mentions) {
    const token = `@${mention.label}`;
    const index = content.indexOf(token, start);

    if (index !== -1 && (nextIndex === -1 || index < nextIndex)) {
      nextMention = mention;
      nextIndex = index;
      nextToken = token;
    }
  }

  if (!nextMention || nextIndex === -1) return null;

  return {
    mention: nextMention,
    index: nextIndex,
    token: nextToken,
  };
}

function renderMessageContent(content: string, mentions: MessageMention[]) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < content.length) {
    const match = findNextMention(content, mentions, cursor);

    if (!match) {
      nodes.push(content.slice(cursor));
      break;
    }

    if (match.index > cursor) {
      nodes.push(content.slice(cursor, match.index));
    }

    nodes.push(
      <MentionCard
        key={`${match.mention.id}-${key}`}
        mention={match.mention}
        className="mx-1 inline-flex align-middle"
      />,
    );
    key += 1;
    cursor = match.index + match.token.length;
  }

  return nodes;
}

function getToneClasses(tone: MessageBubbleTone) {
  switch (tone) {
    case "user":
      return {
        wrapper: "justify-end",
        card: "max-w-2xl bg-primary text-primary-foreground",
        meta: "text-primary-foreground/70",
      };
    case "agent":
      return {
        wrapper: "justify-start",
        card: "max-w-2xl border-primary/30 bg-primary/5",
        meta: "text-muted-foreground",
      };
    case "nonUser":
      return {
        wrapper: "justify-start",
        card: "max-w-2xl bg-card",
        meta: "text-muted-foreground",
      };
  }
}

function formatMessageTimestamp(message: SpaceMessageWithMetadata) {
  if (!message.createdAt) return undefined;

  return formatTimestampTime(message.createdAt);
}

export function MessageBubble({
  message,
  authorNameOverride,
  tone,
}: MessageBubbleProps) {
  const content = message.spaceMessage?.content ?? "";
  const authorName = authorNameOverride ?? message.spaceMessage?.author?.email;
  const timestamp = formatMessageTimestamp(message);
  const mentionList = useMentionUsers();
  const classes = getToneClasses(tone);

  return (
    <div className={cn("flex w-full", classes.wrapper)}>
      <Card size="sm" className={classes.card}>
        {(authorName || timestamp) && (
          <div className={cn("flex items-center gap-2 px-3", classes.meta)}>
            {authorName && <span>{authorName}</span>}
            {timestamp && <span>{timestamp}</span>}
          </div>
        )}
        <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
          {renderMessageContent(content, mentionList)}
        </CardContent>
      </Card>
    </div>
  );
}
