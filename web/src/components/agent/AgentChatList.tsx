import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgentThreadList } from "@/agent-runtime/providers/ThreadProvider";
import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import { useWorkspaceProjects } from "@/components/projects/hooks/useWorkspaceProjects";
import { useAui, useAuiState } from "@assistant-ui/react";
import {
  FolderIcon,
  FolderOpenIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Fragment, useMemo, useState, type SubmitEventHandler } from "react";

type ChatThreadItem = {
  readonly id: string;
  readonly remoteId?: string;
  readonly externalId?: string;
  readonly title?: string;
  readonly custom?: Record<string, unknown>;
};

type ChatSection = {
  key: string;
  title: string;
  projectId?: string;
  items: ChatThreadItem[];
};

export function AgentChatList() {
  const { prepareNewThread } = useAgentThreadList();
  const aui = useAui();
  const projects = useWorkspaceProjects();
  const [expandedSectionKeys, setExpandedSectionKeys] = useState<
    ReadonlySet<string>
  >(new Set());

  const threads = useAuiState((state) => state.threads);
  const chatSections = useMemo(
    () => buildChatSections(projects, threads.threadItems),
    [projects, threads.threadItems],
  );
  const handleNewThread = (projectId?: string) => {
    prepareNewThread(projectId);
    aui.threads().switchToNewThread();
  };
  const toggleSection = (sectionKey: string) => {
    setExpandedSectionKeys((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
        return next;
      }
      next.add(sectionKey);
      return next;
    });
  };

  return (
    <div className="bg-muted/20 flex w-64 shrink-0 flex-col border-r">
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {chatSections.map((section) => {
          const collapsed = !expandedSectionKeys.has(section.key);
          const Folder = collapsed ? FolderIcon : FolderOpenIcon;
          return (
            <Fragment key={section.key}>
              <div className="flex items-center gap-1 pt-3 pb-1">
                <Button
                  variant="ghost"
                  className="flex h-7 min-w-0 flex-1 justify-start gap-2 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                  aria-expanded={!collapsed}
                  onClick={() => toggleSection(section.key)}
                >
                  <Folder className="size-3.5 shrink-0" />
                  <span className="truncate">{section.title}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={`New ${section.title} conversation`}
                  onClick={() => handleNewThread(section.projectId)}
                >
                  <PlusIcon className="size-3.5" />
                </Button>
              </div>
              {!collapsed &&
                section.items.map((threadItem) => (
                  <AgentChatListItem
                    key={threadItem.id}
                    threadItem={threadItem}
                    active={threads.mainThreadId === threadItem.id}
                  />
                ))}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function buildChatSections(
  projects: ProjectMetadata[],
  threadItems: readonly ChatThreadItem[],
): ChatSection[] {
  const sections = new Map<string, ChatSection>();

  sections.set("home", {
    key: "home",
    title: "Home",
    items: [],
  });
  for (const project of projects) {
    sections.set(project.id, {
      key: project.id,
      title: project.name,
      projectId: project.id,
      items: [],
    });
  }
  for (const threadItem of threadItems) {
    if (!threadItem.remoteId) continue;
    const projectId = getThreadProjectId(threadItem);
    const groupKey = projectId ?? "home";
    const existingSection = sections.get(groupKey);
    if (existingSection) {
      existingSection.items.push(threadItem);
      continue;
    }

    sections.set(groupKey, {
      key: groupKey,
      title: groupKey,
      projectId,
      items: [threadItem],
    });
  }

  return Array.from(sections.values());
}

function getThreadProjectId(threadItem: ChatThreadItem) {
  const customProjectId = threadItem.custom?.projectId;
  if (threadItem.externalId) return threadItem.externalId;
  if (typeof customProjectId === "string") return customProjectId;
  return undefined;
}

function AgentChatListItem({
  threadItem,
  active,
}: {
  threadItem: ChatThreadItem;
  active: boolean;
}) {
  const aui = useAui();
  const title = threadItem.title ?? "New Conversation";
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  const startRenaming = () => {
    setDraftTitle(title);
    setRenaming(true);
  };

  const handleRename: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    const nextTitle = draftTitle.trim();
    if (!nextTitle) return;
    aui.threads().item({ id: threadItem.id }).rename(nextTitle);
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-1">
        <form
          className="flex min-w-0 flex-1 items-center gap-1"
          onSubmit={handleRename}
        >
          <Input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.currentTarget.value)}
            className="h-8 min-w-0 flex-1"
            autoFocus
          />
          <Button type="submit" size="sm" className="h-8 shrink-0">
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Cancel rename"
            onClick={() => setRenaming(false)}
          >
            <XIcon className="size-4" />
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <Button
        variant="ghost"
        className="hover:bg-accent data-[active=true]:bg-accent flex h-auto min-w-0 flex-1 justify-start rounded-md px-3 py-2 text-left text-sm font-normal"
        data-active={active}
        onClick={() => aui.threads().switchToThread(threadItem.id)}
      >
        <span className="truncate">{title}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground size-8 shrink-0 opacity-0 group-hover:opacity-100"
        aria-label="Rename conversation"
        onClick={startRenaming}
      >
        <PencilIcon className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive size-8 shrink-0 opacity-0 group-hover:opacity-100"
        aria-label="Delete conversation"
        onClick={() => aui.threads().item({ id: threadItem.id }).delete()}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </div>
  );
}
