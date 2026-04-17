"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/types/database";

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
  organizationId: string;
  selectedTab: "members" | "workload";
  status?: "success" | "error";
  message?: string;
  members: TeamMemberRow[];
  workload: TeamWorkloadRow[];
  roleOptions: RoleType[];
  currentRole: string;
  addMemberAction: (formData: FormData) => Promise<void>;
  updateRoleAction: (formData: FormData) => Promise<void>;
  removeMemberAction: (formData: FormData) => Promise<void>;
};

function completionPct(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export default function TeamTabsClient({
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
  void addMemberAction;

  const canManageMembers = currentRole === "owner" || currentRole === "admin";

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
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Member</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMembers.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No members found.
                        </td>
                      </tr>
                    )}

                    {pagedMembers.map((member) => (
                      <tr key={member.user_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/organizations/${organizationId}/employees/${member.user_id}`}
                            className="block rounded-md transition-colors hover:text-zinc-700"
                          >
                            <p className="font-medium text-foreground">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.email ?? member.user_id}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="w-fit">
                            {member.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {canManageMembers ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <form action={updateRoleAction} className="flex items-center gap-2">
                                <input type="hidden" name="organizationId" value={organizationId} />
                                <input type="hidden" name="userId" value={member.user_id} />
                                <select
                                  name="role"
                                  defaultValue={member.role}
                                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                  {roleOptions.map((role) => (
                                    <option key={`${member.user_id}-${role}`} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                                <Button type="submit" size="sm" variant="outline">
                                  Update Role
                                </Button>
                              </form>
                              <form action={removeMemberAction}>
                                <input type="hidden" name="organizationId" value={organizationId} />
                                <input type="hidden" name="userId" value={member.user_id} />
                                <Button type="submit" size="sm" variant="destructive">
                                  Remove
                                </Button>
                              </form>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Read-only</p>
                          )}
                        </td>
                      </tr>
                    ))}
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

        <TabsContent value="workload" className="space-y-3 pt-2">
          {sortedWorkload.length === 0 && (
            <p className="text-sm text-muted-foreground">No workload data found.</p>
          )}

          {sortedWorkload.map((member) => {
            const pct = completionPct(member.completedTasks, member.totalTasks);
            const barColor =
              pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-blue-500" : "bg-amber-500";

            return (
              <Link
                key={member.user_id}
                href={`/organizations/${organizationId}/employees/${member.user_id}`}
                className="grid grid-cols-1 items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-zinc-300 md:grid-cols-6"
              >
                <div className="md:col-span-2">
                  <p className="font-medium text-foreground">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email ?? member.user_id}</p>
                  <p className="text-sm text-muted-foreground">empID: {member.user_id}</p>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>Total: {member.totalTasks}</p>
                  <p>Done: {member.completedTasks}</p>
                </div>

                <div className="text-sm text-muted-foreground">Hours: {member.allocatedHours}</div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Completion</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
