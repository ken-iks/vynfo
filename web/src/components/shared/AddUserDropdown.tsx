import type { User } from "@/gen/proto/v1/users_pb";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface AddUserDropdownProps {
  users: User[];
  disabled?: boolean;
  isAddingUser?: (user: User) => boolean;
  onSelectUser: (user: User) => void;
}

export function AddUserDropdown({
  users,
  disabled,
  isAddingUser,
  onSelectUser,
}: AddUserDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={disabled || users.length === 0}
          aria-label="Add user"
        >
          <UserPlusIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {users.length === 0 ? (
          <DropdownMenuItem disabled>No users to add</DropdownMenuItem>
        ) : (
          users.map((user) => (
            <DropdownMenuItem
              key={user.userId}
              disabled={isAddingUser?.(user)}
              onSelect={() => onSelectUser(user)}
            >
              {user.email}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
