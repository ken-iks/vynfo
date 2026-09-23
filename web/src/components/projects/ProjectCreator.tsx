import type { User } from "@/gen/proto/v1/users_pb";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export function ProjectCreator({ user }: { user: User | undefined }) {
  const displayName = user?.displayName || user?.email || "Unknown";
  const fallback = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        {user?.signedDisplayPhotoPath && (
          <AvatarImage src={user.signedDisplayPhotoPath} alt={displayName} />
        )}
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <span className="truncate">{displayName}</span>
    </div>
  );
}
