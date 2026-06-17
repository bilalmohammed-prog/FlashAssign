"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  ClipboardList,
  FolderKanban,
  Users,
  Zap,
} from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";
import OrgSwitcher from "@/components/layout/OrgSwitcher";

const NAV_ITEMS = [
  {
    label: "Team",
    href: "team",
    icon: Users,
    matchRoutes: ["team", "employees"],
  },
  {
    label: "Projects",
    href: "projects",
    icon: FolderKanban,
    matchRoutes: ["projects"],
  },
  {
    label: "My Tasks",
    href: "my-tasks",
    icon: ClipboardList,
    matchRoutes: ["my-tasks"],
  },
  {
    label: "Analytics",
    href: "analytics",
    icon: BarChart3,
    matchRoutes: ["analytics"],
  },
  
] as const;

type LeftSideBarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function LeftSideBar({ collapsed, onToggle }: LeftSideBarProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full shrink-0 flex-col justify-between border-r border-zinc-200 bg-white py-6 transition-all duration-200 md:flex ${
        collapsed ? "w-[92px]" : "w-[280px]"
      }`}
    >
      <div className={`space-y-8 ${collapsed ? "px-4" : "px-6"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between gap-3"}`}>
          {!collapsed && (
            <div  className="flex items-center gap-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-brand">
              <Zap className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="text-lg font-semibold tracking-tight text-zinc-800">
              FlashAssign
            </div>
            </div>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex h-9 w-9 items-center justify-center rounded-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 ${
              collapsed ? "mx-auto" : ""
            }`}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <OrgSwitcher collapsed={collapsed} />

        <nav className="mt-8 space-y-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon, matchRoutes }) => {
            const fullHref = `/organizations/${orgId}/${href}`;

            const isActive = matchRoutes.some(
              (route) => pathname.startsWith(`/organizations/${orgId}/${route}`)
            );

            return (
              <Link
                key={href}
                href={fullHref}
                title={collapsed ? label : undefined}
                className={`flex items-center rounded-sm px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200/50"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                } ${collapsed ? "justify-center" : "gap-3"}`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={`mt-auto border-t border-zinc-100 pt-6 ${collapsed ? "px-4" : "px-6"}`}>
        <ProfileMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
