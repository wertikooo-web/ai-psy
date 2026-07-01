/**
 * DAL — consultation payments. SERVER ONLY.
 * One payment record belongs to one consultation and can be edited later.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "consultation-payments.json");

export type PaymentStatus = "unpaid" | "partial" | "paid" | "free" | "cancelled";

export interface ConsultationPayment {
  id: string;
  createdAt: string;
  updatedAt: string;
  clientId?: string;
  consultationId: string;
  chargedAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  paymentDate?: string;
  comment?: string;
}

export interface PaymentInput {
  clientId?: string;
  consultationId: string;
  chargedAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  paymentDate?: string;
  comment?: string;
}

const STATUSES: PaymentStatus[] = ["unpaid", "partial", "paid", "free", "cancelled"];

function normalizeStatus(value: unknown): PaymentStatus {
  return STATUSES.includes(value as PaymentStatus) ? value as PaymentStatus : "unpaid";
}

function rowToPayment(row: Record<string, unknown>): ConsultationPayment {
  return {
    id:             row.id as string,
    createdAt:      row.created_at as string,
    updatedAt:      row.updated_at as string,
    clientId:       (row.client_id as string | null) ?? undefined,
    consultationId: row.consultation_id as string,
    chargedAmount:  Number(row.charged_amount ?? 0),
    paidAmount:     Number(row.paid_amount ?? 0),
    paymentStatus:  normalizeStatus(row.payment_status),
    paymentDate:    (row.payment_date as string | null) ?? undefined,
    comment:        (row.comment as string | null) ?? undefined,
  };
}

function paymentToRow(input: PaymentInput) {
  return {
    client_id:        input.clientId || null,
    consultation_id:  input.consultationId,
    charged_amount:   Number(input.chargedAmount || 0),
    paid_amount:      Number(input.paidAmount || 0),
    payment_status:   normalizeStatus(input.paymentStatus),
    payment_date:     input.paymentDate || null,
    comment:          input.comment?.trim() || null,
  };
}

async function readAllLocal(): Promise<ConsultationPayment[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as ConsultationPayment[];
  } catch {
    return [];
  }
}

async function writeAllLocal(data: ConsultationPayment[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function getPayments(): Promise<ConsultationPayment[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("consultation_payments")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`[DAL/getPayments] ${error.message}`);
    return (data ?? []).map(rowToPayment);
  }
  return readAllLocal();
}

export async function getPaymentForConsultation(consultationId: string): Promise<ConsultationPayment | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("consultation_payments")
      .select("*")
      .eq("consultation_id", consultationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(`[DAL/getPaymentForConsultation] ${error.message}`);
    return data ? rowToPayment(data) : null;
  }
  const all = await readAllLocal();
  return all.find((item) => item.consultationId === consultationId) ?? null;
}

export async function upsertPayment(input: PaymentInput): Promise<ConsultationPayment> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const existing = await getPaymentForConsultation(input.consultationId);
    if (existing) {
      const { data, error } = await supabaseServer!
        .from("consultation_payments")
        .update(paymentToRow(input))
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(`[DAL/upsertPayment/update] ${error.message}`);
      return rowToPayment(data);
    }
    const { data, error } = await supabaseServer!
      .from("consultation_payments")
      .insert(paymentToRow(input))
      .select("*")
      .single();
    if (error) throw new Error(`[DAL/upsertPayment/insert] ${error.message}`);
    return rowToPayment(data);
  }

  const all = await readAllLocal();
  const idx = all.findIndex((item) => item.consultationId === input.consultationId);
  const next: ConsultationPayment = {
    id: idx >= 0 ? all[idx].id : crypto.randomUUID(),
    createdAt: idx >= 0 ? all[idx].createdAt : now,
    updatedAt: now,
    clientId: input.clientId,
    consultationId: input.consultationId,
    chargedAmount: Number(input.chargedAmount || 0),
    paidAmount: Number(input.paidAmount || 0),
    paymentStatus: normalizeStatus(input.paymentStatus),
    paymentDate: input.paymentDate || undefined,
    comment: input.comment?.trim() || undefined,
  };
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  await writeAllLocal(all);
  return next;
}

