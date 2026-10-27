import React from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile } from '../lib/constants';

export interface SignInParams {
  email: string;
  password?: string;
  rememberMe?: boolean;
}

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (params: SignInParams) => Promise<{ user: User; profile: UserProfile }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  refreshProfile: () => Promise<UserProfile | null>;
}

export declare const AuthProvider: React.FC<{ children: React.ReactNode }>;
export declare function useAuth(): AuthContextType;
declare const AuthContext: React.Context<AuthContextType | undefined>;
export default AuthContext;
