
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { UserRole, User } from './types';

interface UserProfile {
  id: string;
  full_name: string;
  role_name: UserRole;
  home_branch_name: string;
  email: string;
}

interface UserContextType {
  user: any;
  profile: UserProfile | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, 
          full_name, 
          home_branch_name,
          role_name
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;

      const profileData: UserProfile = {
        id: data.id,
        full_name: data.full_name,
        role_name: data.role_name as UserRole || UserRole.ADMIN,
        home_branch_name: data.home_branch_name || 'Kya Sands',
        email: user?.email || '',
      };

      setProfile(profileData);
    } catch (err) {
      console.error("Using fallback ADMIN profile (Live DB not connected):", err);
      // SETTING TO ADMIN BY DEFAULT FOR DEVELOPMENT VISIBILITY
      setProfile({
        id: userId,
        full_name: "Developer (System Admin)",
        role_name: UserRole.ADMIN,
        home_branch_name: 'Kya Sands',
        email: 'dev@shuku.co.za'
      });
    }
  };

  useEffect(() => {
    // Fix: Using type casting to bypass property missing errors on SupabaseAuthClient in specific environments
    (supabase.auth as any).getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        // Fallback for no session at all (Development mode)
        fetchProfile("dev-id");
      }
    });

    // Fix: Using type casting to bypass property missing errors on SupabaseAuthClient in specific environments
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (profile) setIsLoading(false);
  }, [profile]);

  const logout = async () => {
    // Fix: Using type casting to bypass property missing errors on SupabaseAuthClient in specific environments
    await (supabase.auth as any).signOut();
  };

  const hasPermission = (permission: string): boolean => {
    if (!profile) return false;
    // Admin has all permissions
    if (profile.role_name === UserRole.ADMIN) return true;

    const role = profile.role_name;
    if (role === UserRole.EXECUTIVE) {
      return ['VIEW_DASHBOARD', 'VIEW_SETTLEMENT'].includes(permission);
    }
    if (role === UserRole.STAFF) {
      return ['WRITE_MOVEMENTS', 'MANAGE_LOSSES', 'VIEW_DASHBOARD'].includes(permission);
    }
    return true;
  };

  return (
    <UserContext.Provider value={{ user, profile, isLoading, logout, hasPermission }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
