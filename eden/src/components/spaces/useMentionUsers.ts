import { useAuthSwitcher } from "../providers/AuthProvider";
import { usersToMentions, withVynfoAgentMention } from "./MentionCard";

export function useMentionUsers() {
  const { users } = useAuthSwitcher();

  return withVynfoAgentMention(usersToMentions(users));
}
