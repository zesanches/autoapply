export type Platform = "indeed" | "linkedin";

export type ApplicationStatus =
  | "queued"
  | "applying"
  | "submitted"
  | "failed"
  | "retrying"
  | "exhausted";

export type Plan = "FREE" | "PRO" | "ENTERPRISE";

export type CreditTransactionType = "PURCHASE" | "GRANT" | "DEBIT" | "REFUND";

export type CreditTransactionStatus =
  | "PENDING"
  | "RESERVED"
  | "CONFIRMED"
  | "ROLLED_BACK";

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
