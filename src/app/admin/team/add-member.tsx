"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/components/brand";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { initials } from "@/lib/format";
import { addMemberAction, searchUsersAction } from "@/server/actions/admin";
import type { UserSearchResult } from "@/server/teams";

/** Search registered accounts by name or @username and add them to the team. */
export function AddMember() {
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
      const found = await searchUsersAction(q);
      // Ignore responses for queries the user has already typed past.
      if (id === requestId.current) {
        setResults(found);
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  function add(user: UserSearchResult) {
    setAddingId(user.id);
    startAdding(async () => {
      const res = await addMemberAction(user.id);
      setAddingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data.name} added to the team`);
      setResults((rs) => rs.map((r) => (r.id === user.id ? { ...r, inTeam: true } : r)));
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
        <Button>
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
                Start typing to find people who have a {APP_NAME} account.
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
                {results.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={u.id}
                    disabled={u.inTeam || adding}
                    onSelect={() => !u.inTeam && add(u)}
                    className="gap-3"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                    </Avatar>
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
                    ) : (
                      <span className="text-xs font-medium text-primary">Add</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
