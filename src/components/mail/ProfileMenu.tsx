"use client";

import { useState } from "react";
import { Loader2, LogOut, Settings } from "lucide-react";
import { UserProfile, useUser } from "@clerk/nextjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ProfileMenuProps {
  onSignOut: () => void;
  isSigningOut: boolean;
}

export function ProfileMenu({ onSignOut, isSigningOut }: ProfileMenuProps) {
  const { user } = useUser();
  const [profileOpen, setProfileOpen] = useState(false);
  const imageUrl = user?.imageUrl ?? "";
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    (user?.emailAddresses?.[0]?.emailAddress ?? "Account");
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="user-avatar overflow-hidden focus:outline-none focus-visible:shadow-[var(--ring)]"
            aria-label="Account menu"
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{name.charAt(0).toUpperCase()}</span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[240px] rounded-xl border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-center gap-3 border-b border-[var(--line-soft)] px-2 py-3">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-[15px] font-semibold text-[var(--ink-2)]">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold tracking-[-0.012em] text-[var(--ink)]">{name}</p>
              {email && (
                <p className="truncate text-[11.5px] text-[var(--ink-3)]">{email}</p>
              )}
            </div>
          </div>
          <DropdownMenuItem
            onClick={() => setProfileOpen(true)}
            className="mt-1 cursor-pointer rounded-lg text-[13px] text-[var(--ink-1)] focus:bg-[var(--surface-3)] focus:text-[var(--ink)]"
          >
            <Settings className="h-4 w-4" />
            Manage account
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onSignOut}
            disabled={isSigningOut}
            variant="destructive"
            className="cursor-pointer rounded-lg text-[13px] text-[var(--rose)] focus:bg-[var(--rose-soft)] focus:text-[var(--rose)]"
          >
            {isSigningOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex w-[min(880px,calc(100vw-2rem))] max-h-[min(720px,calc(100vh-2rem))] max-w-none flex-col overflow-hidden border-[#e5e7eb] bg-white p-0 dark:border-[#ffffff] dark:bg-[#ffffff] sm:max-w-none"
        >
          <DialogTitle className="sr-only">Manage account</DialogTitle>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <UserProfile routing="virtual" />
          </div>
          <div className="shrink-0 border-t border-[#e5e7eb] bg-white p-3 dark:border-[#e5e7eb] dark:bg-white [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                onSignOut();
              }}
              disabled={isSigningOut}
              className="flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-[#f4c7c1] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#d93025] transition-colors hover:bg-[#fce8e6] disabled:opacity-70 [touch-action:manipulation]"
              aria-label={isSigningOut ? "Signing out" : "Sign out"}
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 shrink-0" />
              )}
              <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
