import * as Icons from "../icons";

export type NavItem = {
  title: string;
  url?: string;
  icon: React.ComponentType<Icons.PropsType>;
  items: { title: string; url: string }[];
  /** Feature key - item hidden if feature disabled. Omit for always-visible (Dashboard, Settings). */
  featureKey?: string;
  /** Permission required to see this item (e.g. ledger:read). Omit for always-visible. */
  permission?: string;
  /** Admin-only: only shown when user has admin role for the business */
  adminOnly?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_DATA: NavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      {
        title: "Dashboard",
        icon: Icons.HomeIcon,
        url: "/",
        items: [],
      },
    ],
  },
  {
    label: "SALES",
    items: [
      {
        title: "Invoices",
        icon: Icons.DocumentIcon,
        url: "/invoices",
        items: [],
        featureKey: "invoicing",
        permission: "invoices:read",
      },
      {
        title: "Customers",
        icon: Icons.User,
        url: "/customers",
        items: [],
        featureKey: "invoicing",
        permission: "invoices:read",
      },
      {
        title: "Pending Approvals",
        icon: Icons.Calendar,
        url: "/invoices/pending-approval",
        items: [],
        featureKey: "invoicing",
        permission: "invoices:write",
      },
    ],
  },
  {
    label: "FINANCES",
    items: [
      {
        title: "Ledger",
        icon: Icons.ChartBarIcon,
        url: "/ledger",
        items: [],
        featureKey: "ledger",
        permission: "ledger:read",
      },
      {
        title: "Receipts",
        icon: Icons.ReceiptIcon,
        url: "/receipts",
        items: [],
        featureKey: "receipts",
        permission: "receipts:read",
      },
      {
        title: "Mobile Money",
        icon: Icons.Authentication,
        url: "/reconciliation",
        items: [],
        featureKey: "mobile_money_recon",
        permission: "ledger:write",
      },
      {
        title: "Debts",
        icon: Icons.Alphabet,
        url: "/debts",
        items: [],
        featureKey: "debt_tracker",
        permission: "ledger:read",
      },
      {
        title: "Suppliers",
        icon: Icons.User,
        url: "/suppliers",
        items: [],
        permission: "ledger:read",
      },
    ],
  },
  {
    label: "INVENTORY",
    items: [
      {
        title: "Products",
        icon: Icons.Table,
        url: "/products",
        items: [],
        featureKey: "inventory_lite",
        permission: "inventory:read",
      },
    ],
  },
  {
    label: "REPORTS",
    items: [
      {
        title: "Reports",
        icon: Icons.PieChart,
        url: "/reports",
        items: [
          { title: "P&L", url: "/reports" },
          { title: "Cash Flow", url: "/reports/cash-flow" },
          { title: "Tax / VAT", url: "/reports/tax" },
          { title: "Consolidated", url: "/reports/consolidated" },
        ],
        featureKey: "reports",
        permission: "reports:read",
      },
      {
        title: "Trust Score",
        icon: Icons.ShieldIcon,
        url: "/trust",
        items: [],
        featureKey: "trust_score",
        permission: "reports:read",
      },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      {
        title: "Branches",
        icon: Icons.FourCircle,
        url: "/settings/branches",
        items: [],
        permission: "reports:read",
      },
      {
        title: "Settings",
        icon: Icons.SettingsIcon,
        url: "/settings",
        items: [
          { title: "Plans", url: "/settings" },
          { title: "Business Profile", url: "/settings/profile" },
          { title: "Team", url: "/settings/team" },
          { title: "Activity Log", url: "/settings/activity" },
          { title: "Preferences", url: "/settings/preferences" },
          { title: "API Keys", url: "/settings/api-keys" },
          { title: "Webhooks", url: "/settings/webhooks" },
          { title: "Compliance", url: "/settings/compliance" },
        ],
      },
    ],
  },
  {
    label: "ADMIN",
    items: [
      {
        title: "Admin",
        icon: Icons.ShieldIcon,
        url: "/admin",
        items: [],
        adminOnly: true,
      },
    ],
  },
];
