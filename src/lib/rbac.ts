import type { Role } from "@/db/schema";

export const ROLE_LABELS: Record<Role, string> = {
  CEO: "المدير التنفيذي",
  DEPT_MANAGER: "مدير قسم",
  SALES_AGENT: "موظف مبيعات",
  CONTENT_MANAGER: "مسؤول محتوى",
  SYSADMIN: "مسؤول النظام",
};

/** Which roles may open each section. CEO always has full access. */
export const ACCESS = {
  dashboard: ["CEO", "DEPT_MANAGER", "SALES_AGENT", "CONTENT_MANAGER", "SYSADMIN"],
  inbox: ["CEO", "DEPT_MANAGER", "SALES_AGENT"],
  simulator: ["CEO", "DEPT_MANAGER", "SALES_AGENT", "CONTENT_MANAGER", "SYSADMIN"],
  crm: ["CEO", "DEPT_MANAGER", "SALES_AGENT"],
  packages: ["CEO", "DEPT_MANAGER", "CONTENT_MANAGER"],
  flexivi: ["CEO", "DEPT_MANAGER", "SYSADMIN"],
  knowledge: ["CEO", "DEPT_MANAGER", "CONTENT_MANAGER"],
  automations: ["CEO", "DEPT_MANAGER"],
  analytics: ["CEO", "DEPT_MANAGER"],
  team: ["CEO", "DEPT_MANAGER", "SYSADMIN"],
  integrations: ["CEO", "SYSADMIN"],
  personality: ["CEO"],
  settings: ["CEO", "SYSADMIN"],
} satisfies Record<string, Role[]>;

export type Section = keyof typeof ACCESS;

export function can(role: Role, section: Section) {
  return role === "CEO" || (ACCESS[section] as Role[]).includes(role);
}

/** Department scoping: managers and agents see only their department; others see all. */
export function scopedDepartment(user: { role: Role; departmentId: string | null }) {
  return user.role === "DEPT_MANAGER" || user.role === "SALES_AGENT" ? user.departmentId : null;
}
