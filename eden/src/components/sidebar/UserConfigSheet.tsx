import { cn } from "@/lib/utils";

export interface UserConfigSheetProps {
    displayPictureUrl?: string;
    displayName: string;
    workspaceName?: string;
}

export function UserConfigSheet({
    displayPictureUrl, displayName, workspaceName
}: UserConfigSheetProps) {
    return (
        <div className={cn(
            "flex", 
            "items-center", 
            "gap-2 px-2 group-data-[collapsible=icon]:hidden"
        )}>
            {displayPictureUrl ? (
                <img
                    src={displayPictureUrl}
                    alt={`${displayName} profile`}
                    className="size-10 rounded-full object-cover"
                />
            ) : (
            <div className={cn(
                "flex",
                "size-10 shrink-0 items-center",
                "justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
            )}>
                {displayName.slice(0, 1).toUpperCase()}
            </div>
            )}
            <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {workspaceName && (
                <p className="truncate text-xs text-muted-foreground">
                {workspaceName}
                </p>
            )}
            </div>
        </div>
    )
}