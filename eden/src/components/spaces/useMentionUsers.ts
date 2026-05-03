import { useAuthContext } from "../providers/AuthProvider";
import { usersToMentions, withVynfoAgentMention } from "./MentionCard";

export function useMentionUsers() {
  const { users } = useAuthContext();

  return withVynfoAgentMention(usersToMentions(users));
}
