import { useWorkspaceContext } from "../../providers/WorkspaceProvider";
import {
  usersToMentions,
  withVynfoAgentMention,
} from "../messages/MentionCard";
import type { User } from "@/gen/proto/v1/users_pb";

export function useMentionUsers() {
  const { currentWorkspace } = useWorkspaceContext();
  let users: User[] = [];
  if (currentWorkspace) {
    users = currentWorkspace.users;
  }
  return withVynfoAgentMention(usersToMentions(users));
}
