import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';
import { isKycDocType, resolveKycUpload, type KycDocStatus, type KycDocType } from '../../lib/kycDocuments';

const KYC_BUCKET = 'kyc-documents';

export interface KycSubmission {
  id: string;
  userId: string;
  userEmail?: string;
  fullName: string;
  dateOfBirth: string;
  address: string;
  phone: string;
  idType: string;
  idNumber: string;
  idDocumentUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  reviewNote?: string;
  createdAt?: Date;
}

function mapSubmission(id: string, data: any): KycSubmission {
  return {
    id,
    userId: data.user_id ?? data.userId ?? '',
    userEmail: data.user_email ?? data.userEmail,
    fullName: data.full_name ?? data.fullName ?? '',
    dateOfBirth: data.date_of_birth ?? data.dateOfBirth ?? '',
    address: data.address ?? '',
    phone: data.phone ?? '',
    idType: data.id_type ?? data.idType ?? '',
    idNumber: data.id_number ?? data.idNumber ?? '',
    idDocumentUrl: data.id_document_url ?? data.idDocumentUrl,
    status: data.status ?? 'pending',
    reviewNote: data.review_note ?? data.reviewNote,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
  };
}

// Some browsers/OSes (notably photos exported via WhatsApp on Android) hand
// File objects with an empty or generic `.type`. Determine it from the file
// extension instead of trusting the browser-reported MIME type.
function resolveContentType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'heic': return 'image/heic';
    case 'webp': return 'image/webp';
    case 'pdf': return 'application/pdf';
    default: return file.type || 'application/octet-stream';
  }
}

export async function uploadKycDocument(userId: string, file: File): Promise<string> {
  const path = `kyc/${userId}/${Date.now()}_${file.name}`;
  const { error: upErr } = await supabase.storage.from(KYC_BUCKET).upload(path, file, { contentType: resolveContentType(file) });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from(KYC_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function submitKyc(input: Omit<KycSubmission, 'id' | 'status' | 'createdAt'>) {
  // The ID file is optional. Leave idDocumentUrl off the document when the
  // client did not upload one.
  const { idDocumentUrl, ...rest } = input;
  return supabase.from(LIVE_COLLECTIONS.kycSubmissions).insert({
    ...rest,
    ...(idDocumentUrl ? { id_document_url: idDocumentUrl } : {}),
    status: 'pending',
    created_at: nowISO(),
  });
}

export async function getKycSubmissionsForUser(userId: string): Promise<KycSubmission[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.kycSubmissions)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapSubmission(d.id, d));
}

export async function getAllKycSubmissions(): Promise<KycSubmission[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.kycSubmissions)
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapSubmission(d.id, d));
}

export async function reviewKyc(id: string, status: 'verified' | 'rejected', reviewNote?: string) {
  await supabase.from(LIVE_COLLECTIONS.kycSubmissions).update({
    status,
    review_note: reviewNote ?? null,
    updated_at: nowISO(),
  }).eq('id', id);
}

export interface KycDocument {
  id: string;
  userId: string;
  userEmail?: string;
  clientName: string;
  docType: string;
  fileName: string;
  storagePath?: string;
  fileUrl?: string;
  fileRemoved: boolean;
  status: KycDocStatus;
  reviewNote?: string;
  submittedAt?: Date;
}

function mapDocument(id: string, data: any): KycDocument {
  return {
    id,
    userId: data.user_id ?? data.userId ?? '',
    userEmail: data.user_email ?? data.userEmail,
    clientName: data.client_name ?? data.clientName ?? '',
    docType: data.doc_type ?? data.docType ?? '',
    fileName: data.file_name ?? data.fileName ?? '',
    storagePath: data.storage_path ?? data.storagePath,
    fileUrl: data.file_url ?? data.fileUrl,
    fileRemoved: data.file_removed === true,
    status: data.status ?? 'pending',
    reviewNote: data.review_note ?? data.reviewNote,
    submittedAt: data.submitted_at ? new Date(data.submitted_at) : undefined,
  };
}

export async function uploadIdentityDocument(input: {
  userId: string;
  userEmail: string;
  clientName: string;
  docType: KycDocType;
  file: File;
}): Promise<void> {
  const resolved = resolveKycUpload(input.file);
  if (!resolved.ok) throw new Error(resolved.error);
  if (!isKycDocType(input.docType)) throw new Error('Select a document type.');

  const safeName = input.file.name.replace(/[^\w.\-]+/g, '_');
  const storagePath = `kyc/${input.userId}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage.from(KYC_BUCKET).upload(storagePath, input.file, { contentType: resolved.contentType });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from(KYC_BUCKET).getPublicUrl(storagePath);
  const fileUrl = data.publicUrl;

  await supabase.from(LIVE_COLLECTIONS.kycDocuments).insert({
    user_id: input.userId,
    user_email: input.userEmail,
    client_name: input.clientName,
    doc_type: input.docType,
    file_name: input.file.name,
    storage_path: storagePath,
    file_url: fileUrl,
    file_removed: false,
    status: 'pending',
    submitted_at: nowISO(),
    updated_at: nowISO(),
  });
}

export async function getKycDocumentsForUser(userId: string): Promise<KycDocument[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.kycDocuments)
    .select('*')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapDocument(d.id, d));
}

export async function getAllKycDocuments(): Promise<KycDocument[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.kycDocuments)
    .select('*')
    .order('submitted_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapDocument(d.id, d));
}

export async function removeIdentityDocument(docRow: KycDocument): Promise<void> {
  if (docRow.status === 'approved') throw new Error('Approved documents cannot be removed.');
  if (docRow.storagePath && !docRow.fileRemoved) {
    const { error } = await supabase.storage.from(KYC_BUCKET).remove([docRow.storagePath]);
    if (error) console.error('Failed to remove KYC document from storage:', error);
  }
  await supabase.from(LIVE_COLLECTIONS.kycDocuments).update({
    file_removed: true,
    updated_at: nowISO(),
  }).eq('id', docRow.id);
}

export async function reviewIdentityDocument(
  id: string,
  status: 'approved' | 'rejected',
  reviewNote?: string,
) {
  if (status === 'rejected' && !reviewNote?.trim()) {
    throw new Error('Add a note explaining the rejection.');
  }
  await supabase.from(LIVE_COLLECTIONS.kycDocuments).update({
    status,
    review_note: reviewNote?.trim() || null,
    reviewed_at: nowISO(),
    updated_at: nowISO(),
  }).eq('id', id);
}
