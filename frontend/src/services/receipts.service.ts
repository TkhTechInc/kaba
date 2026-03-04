import { api } from "@/lib/api-client";

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

    process: (businessId: string, body: { s3Key?: string; imageBase64?: string; currency?: string }) =>
      api.post<ProcessReceiptResult>("/api/v1/receipts/process", { businessId, ...body }, {
        token: token ?? undefined,
      }),

    sendPdf: (
      businessId: string,
      phone: string,
      payload: SendReceiptPdfPayload,
    ) =>
      api.post<{ success: boolean; messageId?: string }>(
        "/api/v1/receipts/send-pdf",
        { businessId, phone, ...payload },
        { token: token ?? undefined },
      ),
  };
}
