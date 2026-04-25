import { useState } from "react";
import { useAuthSwitcher } from "@/components/providers/AuthProvider";
import { usersClient } from "@/lib/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UserSwitcher() {
  const { userId, setUserId, users, refreshUsers } = useAuthSwitcher();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await usersClient.createUser({ email: trimmed });
      const list = await refreshUsers();
      const created = list.find((u) => u.userId === res.createdUserId);
      if (created) setUserId(created.userId);
      setEmail("");
      setOpen(false);
    } catch (err) {
      console.error("failed to create user", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-popover/90 p-1 ring-1 ring-foreground/10 backdrop-blur-xs">
      <span className="px-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        dev user
      </span>
      <Select
        value={userId || undefined}
        onValueChange={(next) => setUserId(next)}
      >
        <SelectTrigger size="sm">
          <SelectValue placeholder="No user" />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.userId} value={u.userId}>
              {u.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="icon-sm" variant="outline" aria-label="Create user">
            +
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Create dev user</DialogTitle>
              <DialogDescription>
                Throwaway user used to switch identities while testing.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1">
              <label htmlFor="dev-user-email" className="text-xs font-medium">
                Email
              </label>
              <Input
                id="dev-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@example.com"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !email.trim()}>
                {submitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
