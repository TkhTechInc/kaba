import { api } from "@/lib/api-client";

export type NotificationType =
  | "invoice.created"
  | "invoice.paid"
  | "invoice.overdue"
  | "payment.received"
  | "team.member_joined"
  | "team.member_invited"
  | "debt.reminder"
  | "plan.upgraded"
  | "plan.expiring";

export interface Notification {
  id: string;
  businessId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  refId?: string;
  read: boolean;
  createdAt: string;
}

export interface ListNotificationsResponse {
  items: Notification[];
  unread: number;
}

export const notificationsService = {
  async list(
    businessId: string,
    token: string,
    limit = 30,
  ): Promise<ListNotificationsResponse> {
    const res = await api.get<ListNotificationsResponse>(
      `/api/v1/notifications`,
      { token, params: { businessId, limit: String(limit) } },
    );
    return (res as { data?: ListNotificationsResponse }).data ?? { items: [], unread: 0 };
  },

  async markRead(
    businessId: string,
    id: string,
    createdAt: string,
    token: string,
  ): Promise<void> {
    await api.patch(
      `/api/v1/notifications/${id}/read`,
      { businessId, createdAt },
      { token },
    );
  },

  async markAllRead(businessId: string, token: string): Promise<void> {
    await api.patch(
      `/api/v1/notifications/read-all`,
      { businessId },
      { token },
    );
  },
};
