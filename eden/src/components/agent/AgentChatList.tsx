import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThreadListItemPrimitive, ThreadListPrimitive, useAui, useAuiState } from "@assistant-ui/react";
import { PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState, type SubmitEventHandler } from "react";

export function AgentChatList() {
    return (
        <ThreadListPrimitive.Root className="bg-muted/20 flex w-64 shrink-0 flex-col border-r">
            <div className="border-b p-3">
                <ThreadListPrimitive.New asChild>
                    <Button className="w-full" size="sm">
                        New Chat
                    </Button>
                </ThreadListPrimitive.New>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <ThreadListPrimitive.Items>
                    {() => <AgentChatListItem />}
                </ThreadListPrimitive.Items>
            </div>
        </ThreadListPrimitive.Root>
    );
}

function AgentChatListItem() {
    const aui = useAui();
    const title = useAuiState((state) => state.threadListItem.title ?? "New Conversation");
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
        await aui.threadListItem().rename(nextTitle);
        setRenaming(false);
    };

    if (renaming) {
        return (
            <ThreadListItemPrimitive.Root className="flex items-center gap-1">
                <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={handleRename}>
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
            </ThreadListItemPrimitive.Root>
        );
    }

    return (
        <ThreadListItemPrimitive.Root className="group flex items-center gap-1">
            <ThreadListItemPrimitive.Trigger className="hover:bg-accent data-[active=true]:bg-accent flex min-w-0 flex-1 rounded-md px-3 py-2 text-left text-sm">
                <span className="truncate">
                    <ThreadListItemPrimitive.Title />
                </span>
            </ThreadListItemPrimitive.Trigger>
            <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground size-8 shrink-0 opacity-0 group-hover:opacity-100"
                aria-label="Rename conversation"
                onClick={startRenaming}
            >
                <PencilIcon className="size-4" />
            </Button>
            <ThreadListItemPrimitive.Delete asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-8 shrink-0 opacity-0 group-hover:opacity-100"
                    aria-label="Delete conversation"
                >
                    <Trash2Icon className="size-4" />
                </Button>
            </ThreadListItemPrimitive.Delete>
        </ThreadListItemPrimitive.Root>
    );
}
