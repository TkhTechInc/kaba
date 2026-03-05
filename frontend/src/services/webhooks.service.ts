import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";

export interface Webhook {
  id: string;
  businessId: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: string;
}

export type WebhookEvent =
  | "ledger.entry.created"
  | "ledger.entry.deleted"
  | "invoice.paid"
  | "invoice.created"
  | "payment.received"
  | "inventory.low_stock";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  "invoice.created",
  "invoice.paid",
  "payment.received",
  "ledger.entry.created",
  "ledger.entry.deleted",
  "inventory.low_stock",
];

export function createWebhooksApi(token: string | null) {
  return {
    list: (businessId: string) =>
      apiGet<{ success: boolean; data: Webhook[] }>(
        `/api/v1/webhooks?businessId=${encodeURIComponent(businessId)}`,
        { token: token ?? undefined }
      ),
    register: async (input: { businessId: string; url: string; secret: string; events: WebhookEvent[] }) => {
      const synthetic: Webhook = {
        id: "queued",
        businessId: input.businessId,
        url: input.url,
        events: input.events,
        enabled: true,
        createdAt: new Date().toISOString(),
      };
      const result = await offlineMutation<{ success: boolean; data: Webhook }>(
        "/api/v1/webhooks",
        "POST",
        input,
        token,
        { success: true, data: synthetic }
      );
      return (result.data as { success: boolean; data: Webhook }) ?? { success: true, data: synthetic };
    },
    unregister: async (id: string, businessId: string) => {
      const result = await offlineMutation<{ success: boolean }>(
        `/api/v1/webhooks/${id}?businessId=${encodeURIComponent(businessId)}`,
        "DELETE",
        {},
        token,
        { success: true }
      );
      return result.data as { success: boolean };
    },
  };
}
