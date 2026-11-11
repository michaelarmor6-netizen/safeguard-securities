import { supabase, nowISO } from '../../config/supabase';
import { fundingReference } from './fundingDetailsService';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

const PROOF_BUCKET = 'payment-proofs';

// Two-step lifecycle (2026-08-24): 'approved' now means "approved - funding
// details sent to the client, awaiting their payment" (awaitingPayment=true);
// the wallet is only credited when finance confirms receipt ('funded').
// Legacy rows approved before this change were credited AT approval and have
// no awaitingPayment flag - never show them a Confirm button (double-credit).
// A proof-of-payment file the client attached after tapping "I've sent the
// payment" - a bank transfer screenshot, wire receipt PDF, etc. Stored in
// Storage under payment-proofs/{userId}/{requestId}/; metadata rides on the
// request doc so both the client card and the admin Funding page can list it.
export interface PaymentProof {
  name: string;
  url: string;
  path: string;
  size: number;
  contentType: string;
  uploadedAt?: Date;
}

export interface FundingRequest {
  id: string;
  userId: string;
  userEmail?: string;
  amount: number;
  status: 'pending' | 'approved' | 'funded' | 'rejected';
  reference?: string; // system-generated SG-FUND{YY}{NNNNN}; legacy rows derive from doc id
  awaitingPayment?: boolean;
  createdAt?: Date;
  approvedAt?: Date;
  fundedAt?: Date;
  paymentClaimedAt?: Date; // client tapped the I-have-sent-the-payment button
  paymentProofs?: PaymentProof[]; // receipts the client uploaded after claiming
  emailSentAt?: Date;
  emailError?: string;
  /** 'admin' = recorded straight onto the client by staff (no client request). */
  source?: 'client' | 'admin';
  /** Free-text finance memo on an admin-recorded credit (wire ref, reason). */
  note?: string;
  recordedByEmail?: string;
  recordedByUid?: string;
}

function mapFunding(id: string, data: any): FundingRequest {
  return {
    id,
    userId: data.user_id ?? data.userId ?? '',
    userEmail: data.user_email ?? data.userEmail,
    amount: Number(data.amount ?? 0),
    status: data.status ?? 'pending',
    reference: data.reference,
    awaitingPayment: data.awaiting_payment === true,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
    approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
    fundedAt: data.funded_at ? new Date(data.funded_at) : undefined,
    paymentClaimedAt: data.payment_claimed_at ? new Date(data.payment_claimed_at) : undefined,
    paymentProofs: Array.isArray(data.payment_proofs)
      ? data.payment_proofs.map((p: any) => ({
          name: String(p.name ?? 'receipt'),
          url: String(p.url ?? ''),
          path: String(p.path ?? ''),
          size: Number(p.size ?? 0),
          contentType: String(p.content_type ?? ''),
          uploadedAt: p.uploaded_at ? new Date(p.uploaded_at) : undefined,
        }))
      : [],
    emailSentAt: data.email_sent_at ? new Date(data.email_sent_at) : undefined,
    emailError: data.email_error,
    source: data.source === 'admin' ? 'admin' : 'client',
    note: data.note,
    recordedByEmail: data.recorded_by_email,
    recordedByUid: data.recorded_by_uid,
  };
}

export async function getAllFundingRequests(): Promise<FundingRequest[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.fundingRequests)
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapFunding(d.id, d));
}

export async function getPendingFundingRequests() {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.fundingRequests)
    .select('*')
    .eq('status', 'pending');
  if (error || !data) return [];
  return data.map((d) => mapFunding(d.id, d));
}

export async function updateFundingRequest(id: string, status: FundingRequest['status']) {
  await supabase.from(LIVE_COLLECTIONS.fundingRequests).update({ status, updated_at: nowISO() }).eq('id', id);
}

// Single request - used by the funding invoice page. RLS enforces access
// (owner or admin); a client requesting someone else's doc gets a permission
// error surfaced by the caller.
export async function getFundingRequestById(id: string): Promise<FundingRequest | null> {
  const { data, error } = await supabase.from(LIVE_COLLECTIONS.fundingRequests).select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapFunding(data.id, data);
}

export async function getFundingRequestsForUser(userId: string): Promise<FundingRequest[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.fundingRequests)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapFunding(d.id, d));
}

// Live view of the client's own requests: the Wallet page updates the moment
// an admin approves / confirms - no refresh needed (non-technical clients
// never refresh). Returns the unsubscribe function.
export function watchFundingRequestsForUser(
  userId: string,
  onChange: (requests: FundingRequest[]) => void,
  onError?: (e: Error) => void,
) {
  const channel = supabase
    .channel(`funding-requests-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: LIVE_COLLECTIONS.fundingRequests,
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        const { data: rows, error } = await supabase
          .from(LIVE_COLLECTIONS.fundingRequests)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) return onError?.(error);
        onChange((rows ?? []).map((d: any) => mapFunding(d.id, d)));
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Client-side I-have-sent-the-payment: stamps paymentClaimedAt so finance
// knows to go check the bank. RLS allows the owner to update ONLY this field.
export async function claimPaymentSent(id: string) {
  await supabase.from(LIVE_COLLECTIONS.fundingRequests).update({
    payment_claimed_at: nowISO(),
    updated_at: nowISO(),
  }).eq('id', id);
}

// ---- proof of payment upload ----

// What the file picker offers; storage.rules enforces the same set server-side.
export const PROOF_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.doc,.docx';
export const PROOF_MAX_BYTES = 15 * 1024 * 1024;

// Some browsers/OSes (notably photos exported via WhatsApp on Android) hand
// File objects with an empty or generic `.type`. Determine contentType from
// the extension instead. (Same fix as kycService.resolveContentType.)
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

// Upload one receipt and attach its metadata to the request doc.
export async function uploadPaymentProof(requestId: string, userId: string, file: File): Promise<PaymentProof> {
  if (file.size > PROOF_MAX_BYTES) {
    throw new Error(`"${file.name}" is too large - files must be under 15MB.`);
  }
  const contentType = resolveProofContentType(file);
  const safeName = file.name.replace(/[^\w.\- ]+/g, '_');
  const path = `payment-proofs/${userId}/${requestId}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, { contentType });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(path);
  const url = urlData.publicUrl;
  const proof: PaymentProof = { name: file.name, url, path, size: file.size, contentType, uploadedAt: new Date() };
  await supabase.from(LIVE_COLLECTIONS.fundingRequests).update({
    payment_proofs: [proof], // Supabase replaces the array on update
    updated_at: nowISO(),
  }).eq('id', requestId);
  return proof;
}

// The reference shown everywhere for a request: the stored generated number,
// with a fallback to the legacy doc-id form for rows created before the
// generator existed (2026-08-24).
export function requestReference(r: Pick<FundingRequest, 'id' | 'reference'>): string {
  return r.reference ?? fundingReference(r.id);
}

// Generates SG-FUND{YY}{NNNNN} from a per-year sequential counter
// (counters/funding-{YYYY}) so finance gets short, human-quotable,
// collision-free numbers. Counter + request are committed as best-effort
// sequential writes (Supabase has no client-side transaction; the counter
// column should have a unique constraint on year to avoid collisions).
export async function createFundingRequest(userId: string, userEmail: string, amount: number) {
  const now = new Date();
  const year = now.getFullYear();
  const counterId = `funding-${year}`;
  // Read current counter value.
  const { data: counter } = await supabase.from('counters').select('value').eq('id', counterId).maybeSingle();
  const next = (counter ? Number(counter.value ?? 0) : 0) + 1;
  const reference = `SG-FUND${String(year % 100).padStart(2, '0')}${String(next).padStart(5, '0')}`;
  // Upsert counter, then insert request.
  await supabase.from('counters').upsert({ id: counterId, value: next });
  const { data } = await supabase.from(LIVE_COLLECTIONS.fundingRequests).insert({
    user_id: userId,
    user_email: userEmail,
    amount,
    status: 'pending',
    reference,
    created_at: nowISO(),
  }).select().single();
  return data;
}

// Step 1: approve. Does NOT credit the wallet. Sets awaitingPayment so the
// client sees the payment instructions in-app.
export async function approveFundingRequest(request: FundingRequest) {
  await supabase.from(LIVE_COLLECTIONS.fundingRequests).update({
    status: 'approved',
    awaiting_payment: true,
    approved_at: nowISO(),
    updated_at: nowISO(),
  }).eq('id', request.id);
}

// Manual email path: the admin sent the funding details from their own mail
// client (mailto: link on the Funding page) and marks the request as emailed.
export async function markFundingEmailSent(id: string) {
  await supabase.from(LIVE_COLLECTIONS.fundingRequests).update({
    email_sent_at: nowISO(),
    email_error: null,
    updated_at: nowISO(),
  }).eq('id', id);
}

// Step 2: finance confirms the money actually arrived - only now is the
// wallet credited. Guard: only awaitingPayment rows are eligible (legacy
// 'approved' rows were already credited at approval).
export async function confirmFundingReceived(request: FundingRequest): Promise<number> {
  if (request.status !== 'approved' || request.awaitingPayment !== true) {
    throw new Error('Only approved requests awaiting payment can be marked funded.');
  }
  const { data, error } = await supabase.rpc('confirm_funding_receipt', { request_id: request.id });
  if (error) throw error;
  return data.new_balance;
}

// ---- admin-recorded funding (top-up) ----

export interface AddFundsInput {
  userId: string;
  userEmail?: string;
  amount: number;
  /** Finance memo: wire reference, "top-up per call 2026-08-31", etc. */
  note?: string;
}

export interface AddFundsResult {
  requestId: string;
  reference: string;
  amount: number;
  previousBalance: number;
  newBalance: number;
}

export async function addFundsToClient(input: AddFundsInput): Promise<AddFundsResult> {
  if (!input.userId) throw new Error('Pick a client first.');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter an amount greater than zero.');
  }
  const { data, error } = await supabase.rpc('record_client_deposit', {
    user_id: input.userId,
    user_email: input.userEmail,
    amount,
    note: input.note,
  });
  if (error) throw error;
  return data;
}

/** Replays ledger entries for deposits credited before the ledger fix. */
export async function backfillDepositLedger(userId: string) {
  const { data, error } = await supabase.rpc('backfill_deposit_ledger', { user_id: userId });
  if (error) throw error;
  return data;
}
