export interface PaymentRequest {
  id: string;
  amount: string;
  description: string;
  recipient: string;
  status: "pending" | "paid";
  txHash?: string;
  createdAt: number;
  paidAt?: number;
}

const KEY = "payflow_requests";

export function saveRequest(req: PaymentRequest) {
  if (typeof window === "undefined") return;
  const all = getAllRequests();
  all[req.id] = req;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getRequest(id: string): PaymentRequest | null {
  if (typeof window === "undefined") return null;
  const all = getAllRequests();
  return all[id] ?? null;
}

export function updateRequest(id: string, updates: Partial<PaymentRequest>) {
  if (typeof window === "undefined") return;
  const all = getAllRequests();
  if (all[id]) {
    all[id] = { ...all[id], ...updates };
    localStorage.setItem(KEY, JSON.stringify(all));
  }
}

export function getAllRequests(): Record<string, PaymentRequest> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}
