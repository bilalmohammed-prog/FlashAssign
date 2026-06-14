"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/providers/toast";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import type { Database } from "@/lib/types/database";
import { ROLE_DESCRIPTIONS } from "@/lib/auth/role-descriptions";
import type { AppRole } from "@/lib/auth/permissions";

type RoleType = Database["public"]["Enums"]["role_type"];

export type TeamMemberRow = {
  user_id: string;
  name: string;
  email: string | null;
  role: RoleType;
};

export type TeamWorkloadRow = {
  user_id: string;
  name: string;
  email: string | null;
  role: RoleType;
  totalTasks: number;
  completedTasks: number;
  allocatedHours: number;
};

type TeamTabsClientProps = {
  currentUserId: string;
  organizationId: string;
  selectedTab: "members" | "workload";
  status?: "success" | "error";
  message?: string;
  members: TeamMemberRow[];
  workload: TeamWorkloadRow[];
  roleOptions: RoleType[];
  currentRole: string;
  addMemberAction: (formData: FormData) => Promise<void>;
  updateRoleAction: (formData: FormData) => Promise<{ ok: boolean; message?: string }>;
  removeMemberAction: (formData: FormData) => Promise<void>;
};

type PendingRoleChange = {
  userId: string;
  previousRole: RoleType;
  nextRole: RoleType;
};

function completionPct(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}
// INSERT THESE NEW UTILITIES DIRECTLY ABOVE YOUR MAIN "export default function TeamTabsClient" BLOCK:

function getAvatarFallback(name: string) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const gradients = [
    "from-purple-500 to-indigo-500",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-500",
  ];
  const index = name.length % gradients.length;
  return { initials, gradient: gradients[index] };
}

const roleColorMap: Record<string, string> = {
  owner: "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50",
  admin: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
  manager: "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50",
  employee: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
  viewer: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};
export default function TeamTabsClient({
  currentUserId,
  organizationId,
  selectedTab,
  status,
  message,
  members,
  workload,
  roleOptions,
  currentRole,
  addMemberAction,
  updateRoleAction,
  removeMemberAction,
}: TeamTabsClientProps) {
  const [activeTab, setActiveTab] = useState<"members" | "workload">(selectedTab);
  const [memberQuery, setMemberQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | RoleType>("all");
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(10);
  const [workloadQuery, setWorkloadQuery] = useState("");
  const [workloadRoleFilter, setWorkloadRoleFilter] = useState<"all" | RoleType>("all");
  const [workloadPage, setWorkloadPage] = useState(1);
  const [workloadPageSize, setWorkloadPageSize] = useState(10);
  const [roleOverrides, setRoleOverrides] = useState<Record<string, RoleType>>({});
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [memberColumnWidth, setMemberColumnWidth] = useState<number | null>(null);
  const [roleColumnWidth, setRoleColumnWidth] = useState<number | null>(null);
  const workloadTableRef = useRef<HTMLTableElement | null>(null);
  const workloadMemberHeaderRef = useRef<HTMLTableCellElement | null>(null);
  const workloadRoleHeaderRef = useRef<HTMLTableCellElement | null>(null);
  const { addToast } = useToast();
  const { setCanManageMembers } = usePageHeader();
  void addMemberAction;

  const canManageMembers = currentRole === "owner" || currentRole === "admin";

  useEffect(() => {
    setCanManageMembers(canManageMembers);

    return () => {
      setCanManageMembers(false);
    };
  }, [canManageMembers, setCanManageMembers]);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );

  const filteredMembers = useMemo(() => {
    const normalizedQuery = memberQuery.trim().toLowerCase();

    return sortedMembers.filter((member) => {
      const matchesRole = roleFilter === "all" || member.role === roleFilter;

      if (!normalizedQuery) {
        return matchesRole;
      }

      const haystack = `${member.name} ${member.email ?? ""}`.toLowerCase();
      return matchesRole && haystack.includes(normalizedQuery);
    });
  }, [memberQuery, roleFilter, sortedMembers]);

  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / membersPageSize));
  const safeMembersPage = Math.min(membersPage, totalMemberPages);

  const pagedMembers = useMemo(() => {
    const start = (safeMembersPage - 1) * membersPageSize;
    return filteredMembers.slice(start, start + membersPageSize);
  }, [filteredMembers, safeMembersPage, membersPageSize]);

  const sortedWorkload = useMemo(
    () => [...workload].sort((a, b) => b.totalTasks - a.totalTasks),
    [workload]
  );

  const filteredWorkload = useMemo(() => {
    const normalizedQuery = workloadQuery.trim().toLowerCase();

    return sortedWorkload.filter((member) => {
      const matchesRole = workloadRoleFilter === "all" || member.role === workloadRoleFilter;

      if (!normalizedQuery) {
        return matchesRole;
      }

      const haystack = `${member.name} ${member.email ?? ""}`.toLowerCase();
      return matchesRole && haystack.includes(normalizedQuery);
    });
  }, [sortedWorkload, workloadQuery, workloadRoleFilter]);

  const totalWorkloadPages = Math.max(1, Math.ceil(filteredWorkload.length / workloadPageSize));
  const safeWorkloadPage = Math.min(workloadPage, totalWorkloadPages);

  const pagedWorkload = useMemo(() => {
    const start = (safeWorkloadPage - 1) * workloadPageSize;
    return filteredWorkload.slice(start, start + workloadPageSize);
  }, [filteredWorkload, safeWorkloadPage, workloadPageSize]);

  const getEffectiveRole = (member: TeamMemberRow): RoleType => {
    return roleOverrides[member.user_id] ?? member.role;
  };

  const syncMembersGeometryFromWorkload = useCallback(() => {
    const memberWidth = workloadMemberHeaderRef.current?.getBoundingClientRect().width ?? 0;
    const roleWidth = workloadRoleHeaderRef.current?.getBoundingClientRect().width ?? 0;

    if (memberWidth > 0) {
      setMemberColumnWidth(memberWidth);
    }

    if (roleWidth > 0) {
      setRoleColumnWidth(roleWidth);
    }
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      syncMembersGeometryFromWorkload();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [syncMembersGeometryFromWorkload, activeTab]);

  useEffect(() => {
    const table = workloadTableRef.current;
    if (!table || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncMembersGeometryFromWorkload();
    });

    observer.observe(table);
    return () => observer.disconnect();
  }, [syncMembersGeometryFromWorkload]);

  async function submitRoleUpdate(userId: string, previousRole: RoleType, nextRole: RoleType) {
    if (previousRole === nextRole) {
      return;
    }

    setRoleOverrides((prev) => ({
      ...prev,
      [userId]: nextRole,
    }));
    setUpdatingMemberId(userId);

    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("userId", userId);
    formData.set("role", nextRole);
    formData.set("inline", "1");

    const result = await updateRoleAction(formData);

    if (!result.ok) {
      setRoleOverrides((prev) => ({
        ...prev,
        [userId]: previousRole,
      }));
      setUpdatingMemberId(null);
      addToast(result.message ?? "Failed to update role", "error");
      return;
    }

    setUpdatingMemberId(null);
    addToast(`Role updated to ${nextRole}`, "success", {
      label: "Undo",
      onClick: () => {
        void submitRoleUpdate(userId, nextRole, previousRole);
      },
    });
  }

  function onRoleSelect(member: TeamMemberRow, selectedRole: RoleType) {
    const previousRole = getEffectiveRole(member);

    if (selectedRole === previousRole) {
      return;
    }

    const toOwner = selectedRole === "owner";
    const fromOwner = previousRole === "owner" && !toOwner;
    const requiresConfirmation = toOwner || fromOwner;

    if (requiresConfirmation) {
      setPendingRoleChange({
        userId: member.user_id,
        previousRole,
        nextRole: selectedRole,
      });
      return;
    }

    void submitRoleUpdate(member.user_id, previousRole, selectedRole);
  }

  function roleBadgeClass(role: RoleType): string {
    if (role === "owner") {
      return "border-indigo-300 bg-indigo-50 text-indigo-700";
    }

    if (role === "employee") {
      return "border-zinc-300 bg-zinc-100 text-zinc-700";
    }

    return "";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Team</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage organization members and monitor workload in one place.
        </p>
      </div>

      {status === "success" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message ?? "Operation completed successfully"}
        </p>
      )}

      {status === "error" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {message ?? "Operation failed"}
        </p>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "members" | "workload")}>
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="members" className="flex-none px-4">
            Members
          </TabsTrigger>
          <TabsTrigger value="workload" className="flex-none px-4">
            Workload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6 pt-2">
          <div className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                value={memberQuery}
                onChange={(e) => {
                  setMemberQuery(e.target.value);
                  setMembersPage(1);
                }}
                placeholder="Search by name or email..."
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as "all" | RoleType);
                  setMembersPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="all">All roles</option>
                {roleOptions.map((role) => (
                  <option key={`filter-${role}`} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select
                value={String(membersPageSize)}
                onChange={(e) => {
                  setMembersPageSize(Number(e.target.value));
                  setMembersPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
              </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-full border-collapse table-fixed">
                  <colgroup>
                    <col style={memberColumnWidth ? { width: `${memberColumnWidth}px` } : undefined} />
                    <col style={roleColumnWidth ? { width: `${roleColumnWidth}px` } : undefined} />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Member</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium pl-50" colSpan={3}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMembers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No members found.
                        </td>
                      </tr>
                    )}


                  {pagedMembers.map((member) => {
                    const isMe = member.user_id === currentUserId;
                    const effectiveRole = getEffectiveRole(member);
                    const avatar = getAvatarFallback(member.name);

                    return (
                      <tr 
                        key={member.user_id} 
                        className={`border-b border-border last:border-0 transition-colors ${
                          isMe ? "bg-violet-50/40 hover:bg-violet-50/70 dark:bg-violet-950/10" : "hover:bg-muted/40"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/organizations/${organizationId}/employees/${member.user_id}`}
                            className="flex items-center gap-3 rounded-md transition-colors"
                          >
                            {/* Professional Initials Avatar */}
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white text-xs font-semibold shadow-sm ${avatar.gradient}`}>
                              {avatar.initials}
                            </div>
                            
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground tracking-tight truncate flex items-center gap-1.5">
                                {member.name}
                                {isMe && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium dark:bg-violet-900/50 dark:text-violet-300">You</span>}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">{member.email ?? member.user_id}</span>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`w-fit capitalize shadow-sm font-medium ${roleColorMap[effectiveRole] || roleColorMap.employee}`}>
                            {effectiveRole}
                          </Badge>
                        </td>
                        <td className="px-4 py-3" colSpan={3}>
                          {canManageMembers ? (
                            <div className="flex w-full flex-wrap items-center justify-start gap-2 pl-30">
                              <Select
                                value={getEffectiveRole(member)}
                                onValueChange={(value) => onRoleSelect(member, value as RoleType)}
                                disabled={updatingMemberId === member.user_id}
                              >
                                <SelectTrigger className="h-9 min-w-36 bg-background text-sm">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {roleOptions.map((role) => (
                                    <SelectItem key={`${member.user_id}-${role}`} value={role}>
                                      <span className="font-medium capitalize">{role}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <form action={removeMemberAction}>
                                <input type="hidden" name="organizationId" value={organizationId} />
                                <input type="hidden" name="userId" value={member.user_id} />
                                <Button type="submit" size="sm" variant="destructive">
                                  Remove
                                </Button>
                              </form>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground pl-45">Read-only</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Showing {pagedMembers.length} of {filteredMembers.length} members
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={membersPage <= 1}
                  onClick={() => setMembersPage((prev) => Math.max(1, prev - 1))}
                >
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {safeMembersPage} of {totalMemberPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={safeMembersPage >= totalMemberPages}
                  onClick={() => setMembersPage((prev) => Math.min(totalMemberPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="workload" className="space-y-4 pt-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={workloadQuery}
              onChange={(e) => {
                setWorkloadQuery(e.target.value);
                setWorkloadPage(1);
              }}
              placeholder="Search by name or email..."
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
            <select
              value={workloadRoleFilter}
              onChange={(e) => {
                setWorkloadRoleFilter(e.target.value as "all" | RoleType);
                setWorkloadPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All roles</option>
              {roleOptions.map((role) => (
                <option key={`workload-filter-${role}`} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              value={String(workloadPageSize)}
              onChange={(e) => {
                setWorkloadPageSize(Number(e.target.value));
                setWorkloadPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="10">10 / page</option>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table ref={workloadTableRef} className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th ref={workloadMemberHeaderRef} className="px-4 py-3 font-medium">Member</th>
                    <th ref={workloadRoleHeaderRef} className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Tasks</th>
                    <th className="px-4 py-3 font-medium">Hours</th>
                    <th className="px-4 py-3 font-medium">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedWorkload.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No workload data found.
                      </td>
                    </tr>
                  )}

                  {pagedWorkload.map((member) => {
                    const pct = completionPct(member.completedTasks, member.totalTasks);
                    const barColor = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-blue-500" : "bg-amber-500";
                    
                    const isMe = member.user_id === currentUserId;
                    const avatar = getAvatarFallback(member.name);

                    return (
                      <tr 
                        key={member.user_id} 
                        className={`border-b border-border last:border-0 transition-colors ${
                          isMe ? "bg-violet-50/40 hover:bg-violet-50/70 dark:bg-violet-950/10" : "hover:bg-muted/40"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/organizations/${organizationId}/employees/${member.user_id}`}
                            className="flex items-center gap-3 rounded-md transition-colors"
                          >
                            {/* Professional Initials Avatar */}
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white text-xs font-semibold shadow-sm ${avatar.gradient}`}>
                              {avatar.initials}
                            </div>

                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground tracking-tight truncate flex items-center gap-1.5">
                                {member.name}
                                {isMe && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium dark:bg-violet-900/50 dark:text-violet-300">You</span>}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">{member.email ?? member.user_id}</span>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`w-fit capitalize shadow-sm font-medium ${roleColorMap[member.role] || roleColorMap.employee}`}>
                            {member.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{member.completedTasks}</span> / {member.totalTasks}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{member.allocatedHours}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Progress</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-2 w-36 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {pagedWorkload.length} of {filteredWorkload.length} members
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={safeWorkloadPage <= 1}
                onClick={() => setWorkloadPage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {safeWorkloadPage} of {totalWorkloadPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={safeWorkloadPage >= totalWorkloadPages}
                onClick={() => setWorkloadPage((prev) => Math.min(totalWorkloadPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={pendingRoleChange !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPendingRoleChange(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm critical role change</AlertDialogTitle>
            <AlertDialogDescription>
              Changing ownership impacts organization control. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingRoleChange) {
                  return;
                }

                const { userId, previousRole, nextRole } = pendingRoleChange;
                setPendingRoleChange(null);
                void submitRoleUpdate(userId, previousRole, nextRole);
              }}
            >
              Confirm change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
