/**
 * Quick test utility to verify admin → client account synchronization
 */

import { supabase } from '../config/supabase';

export const testAccountSync = async (userId: string, newBalance: number) => {
  try {
    console.log('🧪 Testing account sync for user:', userId);
    console.log('🧪 Setting balance to:', newBalance);

    // Find the user's account document
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    if (!accounts || accounts.length === 0) {
      console.error('🧪 No accounts found for user:', userId);
      return false;
    }

    const accountDoc = accounts[0];
    console.log('🧪 Found account:', accountDoc.id);

    // Update the balance
    const { error: upErr } = await supabase
      .from('accounts')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
        test_update: Date.now() // Add a test field to verify update
      })
      .eq('id', accountDoc.id);

    if (upErr) throw upErr;

    console.log('🧪 ✅ Account balance updated successfully');

    // Verify the update
    const { data: updatedDoc } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountDoc.id)
      .single();
    console.log('🧪 📋 Updated account data:', updatedDoc);

    return true;
  } catch (error) {
    console.error('🧪 ❌ Test failed:', error);
    return false;
  }
};

export const getAccountData = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    if (!data || data.length === 0) {
      console.log('🧪 No accounts found for user:', userId);
      return null;
    }

    const accounts = data.map(doc => ({
      id: doc.id,
      ...doc
    }));

    console.log('🧪 Current accounts:', accounts);
    return accounts;
  } catch (error) {
    console.error('🧪 Error getting account data:', error);
    return null;
  }
};
