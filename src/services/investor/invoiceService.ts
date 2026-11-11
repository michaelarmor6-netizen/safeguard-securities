import { supabase, nowISO } from '../../config/supabase';
import {
  PROOF_ACCEPT,
  PROOF_MAX_BYTES,
  type PaymentProof,
} from './fundingService';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';
import { getPlatformSettings, DEFAULTS } from './settingsService';

const PROOF_BUCKET = 'payment-proofs';

export interface InvoiceNumbering {
  prefix: string;
  includeYear: boolean;
  padLength: number;
}

export function sanitizeInvoicePrefix(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned.slice(0, 16) || DEFAULTS.invoicePrefix;
}

export function clampInvoicePad(n: number): number {
  const v = Math.floor(Number(n) || DEFAULTS.invoicePadLength);
  return Math.min(8, Math.max(3, v));
}

export function formatInvoiceNumber(
  numbering: InvoiceNumbering,
  sequence: number,
  year = new Date().getFullYear(),
): string {
  const prefix = sanitizeInvoicePrefix(numbering.prefix);
  const pad = clampInvoicePad(numbering.padLength);
  const yearPart = numbering.includeYear ? String(year % 100).padStart(2, '0') : '';
  return `${prefix}${yearPart}${String(sequence).padStart(pad, '0')}`;
}

export function invoiceCounterId(includeYear: boolean, year = new Date().getFullYear()): string {
  return includeYear ? `invoices-${year}` : 'invoices';
}

export async function getInvoiceNumbering(): Promise<InvoiceNumbering> {
  const s = await getPlatformSettings();
  return {
    prefix: sanitizeInvoicePrefix(s.invoicePrefix),
    includeYear: s.invoiceIncludeYear,
    padLength: clampInvoicePad(s.invoicePadLength),
  };
}

export async function getInvoiceNextSequence(includeYear: boolean): Promise<number> {
  const { data } = await supabase.from('counters').select('value').eq('id', invoiceCounterId(includeYear)).maybeSingle();
  const last = data ? Number(data.value ?? 0) : 0;
  return last + 1;
}

/** Persist last-issued so the next create uses `nextSequence`. */
export async function setInvoiceNextSequence(includeYear: boolean, nextSequence: number): Promise<void> {
  const n = Math.floor(Number(nextSequence) || 1);
  if (n < 1) throw new Error('Next sequence must be at least 1.');
  await supabase.from('counters').upsert({ id: invoiceCounterId(includeYear), value: n - 1 });
}

export type InvoiceStatus = 'issued' | 'sent' | 'paid' | 'void';
export type InvoiceSendMode = 'auto' | 'manual';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface StaffInvoice {
  id: string;
  number: string;
  userId: string;
  billToName: string;
  billToEmail: string;
  billToCompany?: string;
  billToAddress?: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  taxRate: number;
  taxLabel: string;
  notes?: string;
  paymentTerms?: string;
  dueDate?: Date;
  includePaymentInstructions: boolean;
  sendMode: InvoiceSendMode;
  status: InvoiceStatus;
  issuedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  createdByUid: string;
  createdByEmail: string;
  emailSentAt?: Date;
  emailError?: string;
  paymentClaimedAt?: Date;
  paymentProofs?: PaymentProof[];
  paidAt?: Date;
}

export interface CreateInvoiceInput {
  userId: string;
  billToName: string;
  billToEmail: string;
  billToCompany?: string;
  billToAddress?: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  taxRate: number;
  taxLabel: string;
  notes?: string;
  paymentTerms?: string;
  dueDate?: Date | null;
  includePaymentInstructions: boolean;
  sendMode: InvoiceSendMode;
  createdByUid: string;
  createdByEmail: string;
}

export function invoiceSubtotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function invoiceTaxAmount(items: InvoiceLineItem[], taxRate: number): number {
  return invoiceSubtotal(items) * (Number(taxRate) || 0) / 100;
}

export function invoiceTotal(items: InvoiceLineItem[], taxRate: number): number {
  return invoiceSubtotal(items) + invoiceTaxAmount(items, taxRate);
}

export function formatInvoiceMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function mapLineItems(raw: unknown): InvoiceLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    description: String(item?.description ?? ''),
    quantity: Number(item?.quantity ?? 0),
    unitPrice: Number(item?.unitPrice ?? 0),
  }));
}

function mapInvoice(id: string, data: any): StaffInvoice {
  return {
    id,
    number: data.number ?? '',
    userId: data.user_id ?? data.userId ?? '',
    billToName: data.bill_to_name ?? data.billToName ?? '',
    billToEmail: data.bill_to_email ?? data.billToEmail ?? '',
    billToCompany: data.bill_to_company ?? data.billToCompany,
    billToAddress: data.bill_to_address ?? data.billToAddress,
    currency: data.currency ?? 'USD',
    lineItems: mapLineItems(data.line_items ?? data.lineItems),
    taxRate: Number(data.tax_rate ?? data.taxRate ?? 0),
    taxLabel: data.tax_label ?? data.taxLabel ?? 'Tax',
    notes: data.notes,
    paymentTerms: data.payment_terms ?? data.paymentTerms,
    dueDate: data.due_date ?? data.dueDate ? new Date(data.due_date ?? data.dueDate) : undefined,
    includePaymentInstructions: data.include_payment_instructions === true,
    sendMode: data.send_mode === 'manual' ? 'manual' : 'auto',
    status: (['issued', 'sent', 'paid', 'void'] as InvoiceStatus[]).includes(data.status)
      ? data.status
      : 'issued',
    issuedAt: data.issued_at ? new Date(data.issued_at) : undefined,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    createdByUid: data.created_by_uid ?? data.createdByUid ?? '',
    createdByEmail: data.created_by_email ?? data.createdByEmail ?? '',
    emailSentAt: data.email_sent_at ? new Date(data.email_sent_at) : undefined,
    emailError: data.email_error,
    paymentClaimedAt: data.payment_claimed_at ? new Date(data.payment_claimed_at) : undefined,
    paymentProofs: Array.isArray(data.payment_proofs ?? data.paymentProofs)
      ? (data.payment_proofs ?? data.paymentProofs).map((p: any) => ({
          name: String(p.name ?? 'receipt'),
          url: String(p.url ?? ''),
          path: String(p.path ?? ''),
          size: Number(p.size ?? 0),
          contentType: String(p.content_type ?? p.contentType ?? ''),
          uploadedAt: p.uploaded_at ? new Date(p.uploaded_at) : undefined,
        }))
      : [],
    paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
  };
}

export async function createStaffInvoice(input: CreateInvoiceInput): Promise<string> {
  const items = input.lineItems.filter((i) => i.description.trim() && i.quantity > 0);
  if (!items.length) throw new Error('Add at least one line item.');
  if (!input.billToName.trim()) throw new Error('Bill-to name is required.');
  if (!input.billToEmail.trim() || !input.billToEmail.includes('@')) {
    throw new Error('A valid bill-to email is required.');
  }
  if (!input.userId) throw new Error('Select a client.');

  const now = new Date();
  const year = now.getFullYear();
  const numbering = await getInvoiceNumbering();
  const counterId = invoiceCounterId(numbering.includeYear, year);
  // Read current counter value, then increment (best-effort sequential).
  const { data: counter } = await supabase.from('counters').select('value').eq('id', counterId).maybeSingle();
  const next = (counter ? Number(counter.value ?? 0) : 0) + 1;
  const number = formatInvoiceNumber(numbering, next, year);
  await supabase.from('counters').upsert({ id: counterId, value: next });

  const { data } = await supabase.from(LIVE_COLLECTIONS.invoices).insert({
    number,
    user_id: input.userId,
    bill_to_name: input.billToName.trim(),
    bill_to_email: input.billToEmail.trim().toLowerCase(),
    bill_to_company: input.billToCompany?.trim() || null,
    bill_to_address: input.billToAddress?.trim() || null,
    currency: input.currency || 'USD',
    line_items: items,
    tax_rate: Number(input.taxRate) || 0,
    tax_label: input.taxLabel.trim() || 'Tax',
    notes: input.notes?.trim() || null,
    payment_terms: input.paymentTerms?.trim() || null,
    due_date: input.dueDate ?? null,
    include_payment_instructions: input.includePaymentInstructions,
    send_mode: input.sendMode,
    status: 'issued',
    issued_at: nowISO(),
    created_at: nowISO(),
    created_by_uid: input.createdByUid,
    created_by_email: input.createdByEmail,
  }).select('id').single();
  if (!data) throw new Error('Failed to create invoice');
  const invoiceId = data.id!;

  try {
    await supabase.from(LIVE_COLLECTIONS.clientNotifications).insert({
      user_id: input.userId,
      type: 'invoice',
      title: 'New invoice',
      body: `Invoice ${number} for ${formatInvoiceMoney(invoiceTotal(items, Number(input.taxRate) || 0), input.currency || 'USD')} has been issued to your account.`,
      href: `/invoice/${invoiceId}`,
      read: false,
      created_at: nowISO(),
    });
  } catch (err) {
    console.error('Invoice issued but notification write failed:', err);
  }
  return invoiceId;
}

export async function getInvoiceById(id: string): Promise<StaffInvoice | null> {
  const { data, error } = await supabase.from(LIVE_COLLECTIONS.invoices).select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapInvoice(data.id!, data);
}

export async function getAllInvoices(): Promise<StaffInvoice[]> {
  const { data, error } = await supabase.from(LIVE_COLLECTIONS.invoices).select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapInvoice(d.id!, d));
}

export async function getInvoicesForUser(userId: string): Promise<StaffInvoice[]> {
  try {
    const { data, error } = await supabase
      .from(LIVE_COLLECTIONS.invoices)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((d) => mapInvoice(d.id!, d));
  } catch {
    const { data } = await supabase.from(LIVE_COLLECTIONS.invoices).select('*').eq('user_id', userId);
    return (data ?? [])
      .map((d) => mapInvoice(d.id!, d))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }
}

export async function markInvoiceEmailSent(id: string) {
  await supabase.from(LIVE_COLLECTIONS.invoices).update({
    email_sent_at: nowISO(),
    email_error: null,
    status: 'sent',
    updated_at: nowISO(),
  }).eq('id', id);
}

export async function markInvoicePaid(id: string) {
  await supabase.from(LIVE_COLLECTIONS.invoices).update({
    status: 'paid',
    paid_at: nowISO(),
    updated_at: nowISO(),
  }).eq('id', id);
}

export { PROOF_ACCEPT };

export async function claimInvoicePayment(invoice: StaffInvoice): Promise<void> {
  if (!invoice.id!) throw new Error('Invoice is missing.');
  const now = new Date();
  await supabase.from(LIVE_COLLECTIONS.invoices).update({
    payment_claimed_at: nowISO(),
    status: 'paid',
    paid_at: nowISO(),
    updated_at: nowISO(),
  }).eq('id', invoice.id!);
  try {
    await supabase.from(LIVE_COLLECTIONS.staffNotifications).insert({
      type: 'invoice-payment',
      title: 'Invoice payment reported',
      body: `${invoice.billToName || invoice.billToEmail} reported payment for ${invoice.number}.`,
      href: '/admin/transactions',
      invoice_id: invoice.id!,
      user_id: invoice.userId,
      read: false,
      created_at: nowISO(),
    });
  } catch (err) {
    console.error('Invoice payment claimed but finance notice failed:', err);
  }
}

function resolveProofContentType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'heic': return 'image/heic';
    case 'heif': return 'image/heif';
    case 'pdf': return 'application/pdf';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default: return file.type || 'application/octet-stream';
  }
}

export async function uploadInvoicePaymentProof(
  invoice: StaffInvoice,
  userId: string,
  file: File,
): Promise<PaymentProof> {
  if (file.size > PROOF_MAX_BYTES) {
    throw new Error(`"${file.name}" is too large - files must be under 15MB.`);
  }
  const contentType = resolveProofContentType(file);
  const safeName = file.name.replace(/[^\w.\- ]+/g, '_');
  const path = `payment-proofs/${userId}/invoice-${invoice.id!}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, { contentType });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  const proof: PaymentProof = { name: file.name, url, path, size: file.size, contentType, uploadedAt: new Date() };
  await supabase.from(LIVE_COLLECTIONS.invoices).update({
    payment_proofs: [proof],
    updated_at: nowISO(),
  }).eq('id', invoice.id!);
  return proof;
}

export async function voidInvoice(id: string) {
  await supabase.from(LIVE_COLLECTIONS.invoices).update({
    status: 'void',
    updated_at: nowISO(),
  }).eq('id', id);
}

const INVOICE_MAIL_URL =
  (import.meta.env.VITE_INVOICE_MAIL_URL as string | undefined)?.trim() ||
  'https://safeguard-invoice-mail.sgfintechllc.workers.dev';

export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const token = (session as any)?.access_token;
  if (!token) throw new Error('Sign in required');
  const res = await fetch(INVOICE_MAIL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ invoiceId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Send failed (${res.status})`);
  }
}

export function formatAddress(parts: {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
} | undefined): string {
  if (!parts) return '';
  return [parts.line1, parts.line2, [parts.city, parts.state, parts.postalCode].filter(Boolean).join(', '), parts.country]
    .filter(Boolean)
    .join('\n');
}
