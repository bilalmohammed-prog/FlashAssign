"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  void addMemberAction;

  const canManageMembers = currentRole === "owner" || currentRole === "admin";

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );

  const sortedWorkload = useMemo(
    () => [...workload].sort((a, b) => b.totalTasks - a.totalTasks),
    [workload]
  );

  function onTabChange(nextTab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`?${params.toString()}`);
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

      <Tabs value={selectedTab} onValueChange={onTabChange}>
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="members" className="flex-none px-4">
            Members
          </TabsTrigger>
          <TabsTrigger value="workload" className="flex-none px-4">
            Workload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6 pt-2">
          <div className="space-y-3">
            {sortedMembers.length === 0 && (
              <p className="text-sm text-muted-foreground">No members found.</p>
            )}

            {sortedMembers.map((member) => (
              <div
                key={member.user_id}
                className="grid grid-cols-1 items-center gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-5"
              >
                <div className="md:col-span-2">
                  <p className="font-medium text-foreground">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email ?? member.user_id}</p>
                </div>

                <Badge variant="outline" className="w-fit">
                  {member.role}
                </Badge>

                {canManageMembers ? (
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
                ) : (
                  <p className="text-sm text-muted-foreground">Read-only</p>
                )}

                {canManageMembers && (
                  <form action={removeMemberAction} className="md:justify-self-end">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="userId" value={member.user_id} />
                    <Button type="submit" size="sm" variant="destructive">
                      Remove
                    </Button>
                  </form>
                )}
              </div>
            ))}
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
              <div
                key={member.user_id}
                className="grid grid-cols-1 items-center gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-6"
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
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
