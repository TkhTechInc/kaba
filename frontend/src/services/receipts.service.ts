import { api } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptExtractionResult {
  vendor?: string;
  date?: string;
  total?: number;
  currency?: string;
  lineItems: ReceiptLineItem[];
  rawText?: string;
}

export interface ProcessReceiptResult {
  extracted: ReceiptExtractionResult;
  suggestedCategory: string;
}

export interface SendReceiptPdfPayload {
  vendor?: string;
  date?: string;
  total: number;
  currency?: string;
  items?: ReceiptLineItem[];
}

export function createReceiptsApi(token: string | null) {
  return {
    getUploadUrl: (businessId: string, contentType = "image/jpeg") =>
      api.get<{ uploadUrl: string; key: string }>("/api/v1/receipts/upload-url", {
        token: token ?? undefined,
        params: { businessId, contentType },
      }),

    process: async (businessId: string, body: { s3Key?: string; imageBase64?: string; currency?: string }) => {
      const optimistic: ProcessReceiptResult = {
        extracted: { lineItems: [], currency: body.currency },
        suggestedCategory: "",
      };
      const result = await offlineMutation<ProcessReceiptResult>(
        "/api/v1/receipts/process",
        "POST",
        { businessId, ...body },
        token,
        optimistic
      );
      return result.data;
    },

    sendPdf: async (
      businessId: string,
      phone: string,
      payload: SendReceiptPdfPayload,
    ) => {
      const result = await offlineMutation<{ success: boolean; messageId?: string }>(
        "/api/v1/receipts/send-pdf",
        "POST",
        { businessId, phone, ...payload },
        token,
        { success: true, messageId: "pending" }
      );
      return result.data;
    },
  };
}
