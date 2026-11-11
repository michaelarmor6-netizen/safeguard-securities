import { supabase, nowISO } from '../config/supabase';
import { UserRole } from '../types';

/**
 * Migration utility to fix user roles from uppercase to lowercase
 * Run this once to fix existing users with incorrect role casing
 */
export const migrateUserRoles = async () => {
  try {
    console.log('🔄 Starting user role migration...');

    const { data: users, error } = await supabase.from('users').select('*');
    if (error) throw error;

    let updatedCount = 0;
    const updates: Promise<void>[] = [];

    (users ?? []).forEach((userDoc: any) => {
      const userData = userDoc;
      let newRole = userData.role;

      // Fix role casing
      switch (userData.role) {
        case 'CLIENT':
          newRole = UserRole.CLIENT; // 'client'
          break;
        case 'ADMIN':
          newRole = UserRole.ADMIN; // 'admin'
          break;
        case 'SUPER_ADMIN':
          newRole = UserRole.SUPER_ADMIN; // 'super_admin'
          break;
        default:
          // Role is already correct or unknown
          return;
      }

      if (newRole !== userData.role) {
        console.log(`📝 Updating user ${userDoc.id}: ${userData.role} → ${newRole}`);
        const updatePromise = (async () => {
          await supabase.from('users').update({
            role: newRole,
            updated_at: nowISO()
          }).eq('id', userDoc.id);
        })();
        updates.push(updatePromise);
        updatedCount++;
      }
    });

    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`✅ Migration complete! Updated ${updatedCount} users.`);
    } else {
      console.log('✅ No users need migration - all roles are correct.');
    }

    return { success: true, updatedCount };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error };
  }
};

/**
 * Quick fix for a single user by UID
 */
export const fixUserRole = async (uid: string) => {
  try {
    const { error } = await supabase.from('users').update({
      role: UserRole.CLIENT, // Set to correct client role
      updated_at: nowISO()
    }).eq('id', uid);
    if (error) throw error;
    console.log(`✅ Fixed role for user ${uid}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to fix user ${uid}:`, error);
    return false;
  }
};
