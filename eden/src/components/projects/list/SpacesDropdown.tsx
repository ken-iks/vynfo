import { useEffect, useState } from "react";
import { spacesClient } from "../../../lib/client";
import type { ProjectSpace } from "../../../gen/proto/v1/spaces_pb";
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

export function SpacesDropdown() {
  const userId = useAuth();
  const [userSpaces, setUserSpaces] = useState<ProjectSpace[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);

  useEffect(() => {
    setLoadingSpaces(true);
    spacesClient
      .listUserSpaces({ userId })
      .then((res) => setUserSpaces(res.spaces))
      .catch((err) => {
        console.error("failed to load user spaces", err);
        setUserSpaces([]);
      })
      .finally(() => setLoadingSpaces(false));
  }, [userId]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline">Spaces</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {loadingSpaces ? (
          <DropdownMenuItem disabled>Loading spaces...</DropdownMenuItem>
        ) : userSpaces.length === 0 ? (
          <DropdownMenuItem disabled>No spaces</DropdownMenuItem>
        ) : (
          userSpaces.map((space) => (
            <DropdownMenuItem key={space.spaceId}>
              <div className="flex flex-col gap-1">
                <span>{space.name}</span>
                <span className="text-muted-foreground">
                  {space.users.length} members
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
