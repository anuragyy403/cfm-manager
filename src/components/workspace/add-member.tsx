"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/components/brand";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addMemberAction, searchUsersAction } from "@/server/actions/lead";
import type { UserSearchResult } from "@/server/teams";

/**
 * Search employee accounts by name or @username and add them to the team.
 * Someone on another team can only be moved across by the owner (`canMove`).
 */
export function AddMember({ teamId, canMove = false }: { teamId: string; canMove?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, startAdding] = useTransition();
  const [addingId, setAddingId] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const found = await searchUsersAction(teamId, q);
      // Ignore responses for queries the user has already typed past.
      if (id === requestId.current) {
        setResults(found);
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, teamId]);

  function add(user: UserSearchResult) {
    setAddingId(user.id);
    startAdding(async () => {
      const res = await addMemberAction(teamId, user.id);
      setAddingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.movedFrom
          ? `${res.data.name} moved here from ${res.data.movedFrom}`
          : `${res.data.name} added to the team`,
      );
      setResults((rs) => rs.map((r) => (r.id === user.id ? { ...r, inTeam: true, otherTeam: null } : r)));
    });
  }

  const showResults = query.trim().length > 0;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setQuery("");
          setResults([]);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="brand">
          <UserPlus />
          Add member
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,380px)] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or @username…"
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              if (!v.trim()) setResults([]);
            }}
          />
          <CommandList>
            {!showResults && (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                <Search className="size-5" />
                Start typing to find employees who have a {APP_NAME} account.
              </div>
            )}
            {showResults && searching && results.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </div>
            )}
            {showResults && !searching && (
              <CommandEmpty>No accounts match “{query.trim()}”.</CommandEmpty>
            )}
            {showResults && results.length > 0 && (
              <CommandGroup heading="People">
                {results.map((u) => {
                  const blocked = u.inTeam || (!!u.otherTeam && !canMove);
                  return (
                  <CommandItem
                    key={u.id}
                    value={u.id}
                    disabled={blocked || adding}
                    onSelect={() => !blocked && add(u)}
                    className="gap-3"
                  >
                    <UserAvatar name={u.name} id={u.id} image={u.image} />
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate font-medium">{u.name}</span>
                      {u.username && (
                        <span className="truncate text-xs text-muted-foreground">@{u.username}</span>
                      )}
                    </div>
                    {u.inTeam ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Check className="size-3.5" /> In team
                      </span>
                    ) : addingId === u.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : u.otherTeam ? (
                      <span className="max-w-32 truncate text-right text-xs text-muted-foreground">
                        {canMove ? (
                          <>
                            On {u.otherTeam} · <span className="font-medium text-primary">Move</span>
                          </>
                        ) : (
                          `On ${u.otherTeam}`
                        )}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-primary">Add</span>
                    )}
                  </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
