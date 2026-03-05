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
    label: "HOME",
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
    label: "MONEY IN",
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
        title: "People who owe me",
        icon: Icons.User,
        url: "/debts",
        items: [],
        featureKey: "debt_tracker",
        permission: "ledger:read",
      },
    ],
  },
  {
    label: "MONEY OUT",
    items: [
      {
        title: "Products",
        icon: Icons.Table,
        url: "/products",
        items: [],
        featureKey: "inventory_lite",
        permission: "inventory:read",
      },
      {
        title: "Ledger Entries",
        icon: Icons.Table,
        url: "/ledger",
        items: [],
        featureKey: "ledger",
        permission: "ledger:read",
      },
      {
        title: "Ledger Balance",
        icon: Icons.Table,
        url: "/ledger/balance",
        items: [],
        featureKey: "ledger",
        permission: "ledger:read",
      },
    ],
  },
  {
    label: "RECORDS",
    items: [
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
        icon: Icons.Table,
        url: "/reconciliation",
        items: [],
        featureKey: "mobile_money_recon",
        permission: "ledger:write",
      },
    ],
  },
  {
    label: "APPROVAL",
    items: [
      {
        title: "Pending Approvals",
        icon: Icons.DocumentIcon,
        url: "/invoices/pending-approval",
        items: [],
        featureKey: "invoicing",
        permission: "invoices:write",
      },
    ],
  },
  {
    label: "INSIGHTS",
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
        title: "Settings",
        icon: Icons.SettingsIcon,
        url: "/settings",
        items: [
          { title: "Plans", url: "/settings" },
          { title: "Team", url: "/settings/team" },
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
