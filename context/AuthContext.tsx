'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '@/lib/client/api';

export interface SessionUser {
    id: string;
    email: string;
    role: 'admin' | 'staff' | 'customer';
    fullName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
}

interface AuthContextValue {
    user: SessionUser | null;
    loading: boolean;
    isStaff: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (input: {
        email: string;
        password: string;
        fullName?: string;
        phone?: string;
    }) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);

    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const refresh = useCallback(async () => {
        const { data } = await apiGet<{ user: SessionUser | null }>('/api/auth/me');
        if (!mounted.current) return;
        setUser(data?.user ?? null);
        setLoading(false);
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const signIn = useCallback<AuthContextValue['signIn']>(
        async (email, password) => {
            const { error } = await apiPost('/api/auth/login', { email, password });
            if (error) return { error: error.message };
            await refresh();
            return { error: null };
        },
        [refresh]
    );

    const signUp = useCallback<AuthContextValue['signUp']>(
        async (input) => {
            const { error } = await apiPost('/api/auth/register', input);
            if (error) return { error: error.message };
            await refresh();
            return { error: null };
        },
        [refresh]
    );

    const signOut = useCallback(async () => {
        await apiPost('/api/auth/logout');
        if (mounted.current) setUser(null);
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            loading,
            isStaff: user?.role === 'admin' || user?.role === 'staff',
            signIn,
            signUp,
            signOut,
            refresh,
        }),
        [user, loading, signIn, signUp, signOut, refresh]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used inside an AuthProvider.');
    }
    return context;
}
