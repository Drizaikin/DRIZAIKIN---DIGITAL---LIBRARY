// Use environment variable or relative path for Vercel deployment
// @ts-ignore - Vite env variable
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: 'Reader' | 'Premium' | 'Admin';
  avatarUrl: string;
  email?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  loginAs?: 'reader' | 'premium' | 'admin';
}

export interface RegisterData {
  name: string;
  email: string;
  username: string;
  password: string;
  securityQuestion1?: string;
  securityAnswer1?: string;
  securityQuestion2?: string;
  securityAnswer2?: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store user in sessionStorage - clears when browser/tab closes
    sessionStorage.setItem('drizaikn_user', JSON.stringify(data.user));
    // Also clear any old localStorage data
    localStorage.removeItem('drizaikn_user');
    return data.user;
  },

  async register(userData: RegisterData): Promise<AuthUser> {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // Store user in sessionStorage - clears when browser/tab closes
    sessionStorage.setItem('drizaikn_user', JSON.stringify(data.user));
    // Also clear any old localStorage data
    localStorage.removeItem('drizaikn_user');
    return data.user;
  },

  logout(): void {
    sessionStorage.removeItem('drizaikn_user');
    localStorage.removeItem('drizaikn_user');
  },

  getCurrentUser(): AuthUser | null {
    // Check sessionStorage first (new behavior)
    const sessionStored = sessionStorage.getItem('drizaikn_user');
    if (sessionStored) {
      return JSON.parse(sessionStored);
    }
    // Fallback to localStorage for migration, then clear it
    const localStored = localStorage.getItem('drizaikn_user');
    if (localStored) {
      localStorage.removeItem('drizaikn_user');
      return null; // Force re-login for existing users
    }
    return null;
  },

  updateStoredUser(user: Partial<AuthUser>): void {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...user };
      sessionStorage.setItem('drizaikn_user', JSON.stringify(updatedUser));
    }
  }
};
