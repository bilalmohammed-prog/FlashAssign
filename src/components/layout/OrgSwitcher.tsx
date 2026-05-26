"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { getUserOrganizationsAction } from "@/actions/organization/getUserOrganizations";
import { switchOrganization } from "@/actions/organization/switchOrganization";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
};

type OrgSwitcherProps = {
  collapsed: boolean;
};

export default function OrgSwitcher({ collapsed }: OrgSwitcherProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [orgs, setOrgs] = useState<OrganizationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOrganizations() {
      try {
        setLoading(true);
        setLoadError(null);

        const result = await getUserOrganizationsAction();
        if (!cancelled) {
          if (result.error || !result.data) {
            setOrgs([]);
            setLoadError(result.error?.message ?? "Unable to load organizations");
            return;
          }

          setOrgs(result.data);
        }
      } catch {
        if (!cancelled) {
          setOrgs([]);
          setLoadError("Unable to load organizations");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOrganizations();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeOrg = useMemo(() => {
    return orgs.find((org) => org.id === orgId) ?? null;
  }, [orgId, orgs]);

  async function handleSwitch(targetOrgId: string) {
    if (targetOrgId === "__create__") {
      router.push("/onboarding");
      return;
    }

    if (!targetOrgId || targetOrgId === orgId) {
      return;
    }

    try {
      setSwitchingId(targetOrgId);
      setSwitchError(null);
      const result = await switchOrganization(targetOrgId);
      if (!result.success) {
        setSwitchError(result.error ?? "Failed to switch organization");
        return;
      }

      router.push(`/organizations/${targetOrgId}/team`);
      router.refresh();
    } finally {
      setSwitchingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200/60 bg-zinc-50/60 px-3 py-2 text-xs text-zinc-500">
        Loading organizations...
      </div>
    );
  }

  if (loadError) {
    return (
      <button
        type="button"
        onClick={() => router.refresh()}
        className="w-full rounded-lg border border-red-200/70 bg-red-50/70 px-3 py-2 text-left text-xs text-red-700"
      >
        {loadError}. Click to retry.
      </button>
    );
  }

  const triggerClass = collapsed
  ? "flex h-11 w-full items-center justify-center rounded-lg border-0 bg-transparent p-0 text-zinc-600 shadow-none transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus:ring-0 data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-900 [&>svg]:hidden"
    : "h-10 w-full rounded-md border border-zinc-200/70 bg-white text-sm font-semibold text-zinc-900 shadow-none focus:ring-2 focus:ring-indigo-500";

  const contentProps = collapsed
    ? { position: "popper" as const, side: "right" as const, align: "start" as const, sideOffset: 8 }
    : {};

  const selectTree = (
    <Select
      value={orgId}
      onValueChange={(value) => {
        void handleSwitch(value);
      }}
      disabled={switchingId !== null}
    >
      <SelectTrigger aria-label="Switch organization" className={triggerClass}>
        {collapsed ? (
          <span className="flex items-center justify-center">
            <Building2 className="h-6 w-6 shrink-0 text-zinc-600" strokeWidth={2.5} />
          </span>
        ) : (
          <SelectValue placeholder="Select organization" />
        )}
      </SelectTrigger>
      <SelectContent {...contentProps}>
        {orgs.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            {org.name || org.slug}
          </SelectItem>
        ))}
        <SelectSeparator className="my-1 bg-zinc-100" />
        <SelectItem value="__create__">Create new organization</SelectItem>
      </SelectContent>
    </Select>
  );

  if (collapsed) {
    return <div className="flex justify-center">{selectTree}</div>;
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200/60 bg-zinc-50/60 px-3 py-2 shadow-none">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Current organization
        </p>
      </div>

      {selectTree}

      {switchingId && (
        <p className="text-xs text-zinc-500">Switching organization...</p>
      )}

      {switchError && (
        <p className="text-xs text-red-600">{switchError}</p>
      )}
    </div>
  );
}
