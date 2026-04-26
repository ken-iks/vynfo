import { cn } from "@/lib/utils";
import type { User } from "@/gen/proto/v1/users_pb";

export interface MessageMention {
  id: string;
  label: string;
  description?: string;
}

interface MentionCardProps {
  mention: MessageMention;
  className?: string;
  showPrefix?: boolean;
}

export const vynfoAgentMention: MessageMention = {
  id: "vynfo-agent",
  label: "VynfoAgent",
  description: "Ask the Vynfo agent",
};

export function withVynfoAgentMention(mentions: MessageMention[]) {
  if (mentions.some((mention) => mention.id === vynfoAgentMention.id)) {
    return mentions;
  }

  return [...mentions, vynfoAgentMention];
}

export function usersToMentions(users: User[]): MessageMention[] {
  return users.map((user) => ({
    id: user.userId,
    label: user.email,
  }));
}

export function MentionCard({
  mention,
  className,
  showPrefix = true,
}: MentionCardProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-col rounded-md border bg-popover px-2 py-1 text-popover-foreground shadow-xs",
        className,
      )}
    >
      <span className="text-xs font-medium">
        {showPrefix ? "@" : ""}
        {mention.label}
      </span>
      {mention.description && (
        <span className="text-xs text-muted-foreground">
          {mention.description}
        </span>
      )}
    </span>
  );
}
