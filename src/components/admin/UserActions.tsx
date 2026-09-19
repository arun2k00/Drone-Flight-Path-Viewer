"use client";

import { useState } from "react";
import { KeyRound, MoreHorizontal, ShieldCheck, ShieldOff, Trash, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { deleteUserAction, sendPasswordResetAction, setUserRoleAction, setUserStatusAction } from "@/lib/admin/actions";

interface Target {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

/** One hidden form per action so each menu item is a real form submission (works with the server actions directly). */
function ActionItem({ action, fields, icon: Icon, label, danger }: { action: (f: FormData) => Promise<void>; fields: Record<string, string>; icon: React.ElementType; label: string; danger?: boolean }) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <DropdownMenuItem asChild variant={danger ? "destructive" : "default"}>
        <button type="submit" className="w-full">
          <Icon aria-hidden="true" /> {label}
        </button>
      </DropdownMenuItem>
    </form>
  );
}

export function UserActions({ user }: { user: Target }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const suspended = user.status === "SUSPENDED";
  const admin = user.role === "ADMIN";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <ActionItem action={sendPasswordResetAction} fields={{ userId: user.id }} icon={KeyRound} label="Send password reset" />
          <ActionItem action={setUserRoleAction} fields={{ userId: user.id, role: admin ? "USER" : "ADMIN" }} icon={admin ? ShieldOff : ShieldCheck} label={admin ? "Remove admin" : "Make admin"} />
          <ActionItem
            action={setUserStatusAction}
            fields={{ userId: user.id, status: suspended ? "ACTIVE" : "SUSPENDED" }}
            icon={suspended ? UserCheck : UserX}
            label={suspended ? "Reactivate" : "Suspend"}
            danger={!suspended}
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash aria-hidden="true" /> Delete user…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={(o) => (setConfirming(o), setTyped(""))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {user.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the account, all of its projects, uploaded videos, exports and share links. Type <strong>{user.email}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <form action={deleteUserAction} className="flex flex-col gap-4">
            <input type="hidden" name="userId" value={user.id} />
            <Input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the user's email to confirm" autoComplete="off" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={typed !== user.email}>
                <Trash className="size-4" aria-hidden="true" /> Delete permanently
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
