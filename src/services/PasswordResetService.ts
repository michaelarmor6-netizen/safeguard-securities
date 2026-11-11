import { supabase, nowISO } from '../config/supabase';
import { createPasswordResetRequestNotification } from '../utils/notificationService';

export interface PasswordResetRequest {
  id?: string;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  reason: string;
  additionalInfo?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  submittedAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
  adminNotes?: string;
  requestId: string; // Unique identifier for tracking
}

/**
 * Submit a new password reset request
 */
export const submitPasswordResetRequest = async (
  requestData: Omit<PasswordResetRequest, 'id' | 'submittedAt' | 'status' | 'requestId'>
): Promise<string> => {
  try {
    // Generate a unique request ID
    const requestId = `PWR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const request: Omit<PasswordResetRequest, 'id'> = {
      ...requestData,
      status: 'pending',
      submittedAt: nowISO(),
      requestId
    };

    const { data } = await supabase.from('password_reset_requests').insert(request).select('id').single();
    console.log('Password reset request submitted:', requestId);

    // Create notification for admins
    await createPasswordResetRequestNotification({
      requestId,
      firstName: requestData.firstName,
      lastName: requestData.lastName,
      username: requestData.username,
      reason: requestData.reason
    });

    return requestId;
  } catch (error) {
    console.error('Error submitting password reset request:', error);
    throw new Error('Failed to submit password reset request. Please try again.');
  }
};

/**
 * Get all password reset requests (for admin)
 */
export const getPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
  try {
    const { data, error } = await supabase
      .from('password_reset_requests')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((d) => ({
      id: d.id,
      ...d
    } as PasswordResetRequest));
  } catch (error) {
    console.error('Error fetching password reset requests:', error);
    throw new Error('Failed to fetch password reset requests.');
  }
};

/**
 * Update password reset request status
 */
export const updatePasswordResetRequest = async (
  requestId: string,
  updates: Partial<PasswordResetRequest>,
  adminEmail?: string
): Promise<void> => {
  try {
    const updateData = {
      ...updates,
      reviewed_at: nowISO(),
      reviewed_by: adminEmail
    };

    const { error } = await supabase.from('password_reset_requests').update(updateData).eq('id', requestId);
    if (error) throw error;
    console.log('Password reset request updated:', requestId);
  } catch (error) {
    console.error('Error updating password reset request:', error);
    throw new Error('Failed to update password reset request.');
  }
};

/**
 * Find user by username to get their email for password reset request validation
 */
export const findUserByUsername = async (username: string): Promise<any | null> => {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('username', username);
    if (error) throw error;
    if (!data || data.length === 0) {
      return null;
    }
    const userDoc = data[0];
    return {
      id: userDoc.id,
      ...userDoc
    };
  } catch (error) {
    console.error('Error finding user by username:', error);
    return null;
  }
};
