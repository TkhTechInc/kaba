import { api } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";

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

    create: async (body: CreateDebtInput) => {
      const optimistic: Debt = {
        id: "pending-" + Date.now(),
        businessId: body.businessId,
        debtorName: body.debtorName,
        amount: body.amount,
        currency: body.currency,
        dueDate: body.dueDate,
        status: "pending",
        customerId: body.customerId,
        phone: body.phone,
        notes: body.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = await offlineMutation<Debt>(
        "/api/v1/debts",
        "POST",
        body,
        token,
        optimistic
      );
      return result.data;
    },

    markPaid: async (businessId: string, id: string) => {
      const optimistic: Debt = {
        id,
        businessId,
        debtorName: "",
        amount: 0,
        currency: "",
        dueDate: "",
        status: "paid",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = await offlineMutation<Debt>(
        `/api/v1/debts/${id}/mark-paid?businessId=${encodeURIComponent(businessId)}`,
        "POST",
        {},
        token,
        optimistic
      );
      return result.data;
    },

    sendReminder: async (businessId: string, id: string) => {
      const result = await offlineMutation<SendReminderResult>(
        `/api/v1/debts/${id}/remind?businessId=${encodeURIComponent(businessId)}`,
        "POST",
        {},
        token,
        { sent: false, channel: undefined }
      );
      return result.data;
    },
  };
}
