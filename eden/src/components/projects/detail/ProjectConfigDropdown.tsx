import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Button } from "../../ui/button";
import type { ProjectPage } from "../Projects";

interface ProjectConfigDropDownProps {
  handlePageSelection: (page: ProjectPage) => void;
}

export function ProjectConfigDropDown({
  handlePageSelection,
}: ProjectConfigDropDownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button> Upload Assets </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => handlePageSelection("uploadVideo")}>
          Upload Video
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handlePageSelection("uploadImage")}>
          Upload Image
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
