import { api } from "@/lib/api-client";

export type DebtStatus = "pending" | "paid" | "overdue";

export interface Debt {
  id: string;
  businessId: string;
  debtorName: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: DebtStatus;
  customerId?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDebtInput {
  businessId: string;
  debtorName: string;
  amount: number;
  currency: string;
  dueDate: string;
  customerId?: string;
  phone?: string;
  notes?: string;
}

export interface ListDebtsResult {
  items: Debt[];
  total: number;
  page: number;
  limit: number;
}

export interface SendReminderResult {
  sent: boolean;
  channel?: "sms" | "whatsapp";
}

export function createDebtsApi(token: string | null) {
  return {
    list: (businessId: string, page = 1, limit = 20, status?: DebtStatus) =>
      api.get<ListDebtsResult>("/api/v1/debts", {
        token: token ?? undefined,
        params: {
          businessId,
          page: String(page),
          limit: String(limit),
          ...(status && { status }),
        },
      }),

    create: (body: CreateDebtInput) =>
      api.post<Debt>("/api/v1/debts", body, { token: token ?? undefined }),

    markPaid: (businessId: string, id: string) =>
      api.post<Debt>(`/api/v1/debts/${id}/mark-paid?businessId=${encodeURIComponent(businessId)}`, {}, {
        token: token ?? undefined,
      }),

    sendReminder: (businessId: string, id: string) =>
      api.post<SendReminderResult>(`/api/v1/debts/${id}/remind?businessId=${encodeURIComponent(businessId)}`, {}, {
        token: token ?? undefined,
      }),
  };
}
