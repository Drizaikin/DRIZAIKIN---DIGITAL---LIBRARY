// Use environment variable or relative path for Vercel deployment
// @ts-ignore - Vite env variable
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api';

export interface AuthUser {
  id: string;
  name: string;
  admissionNo: string;
  role: 'Student' | 'Lecturer' | 'Faculty' | 'Admin';
  avatarUrl: string;
  course?: string;
  email?: string;
}

export interface LoginCredentials {
  admissionNo: string;
  password: string;
  loginAs?: 'student' | 'lecturer' | 'admin';
}

export interface RegisterData {
  name: string;
  email: string;
  admissionNo: string;
  password: string;
  course?: string;
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

    // Store user in localStorage for persistence
    localStorage.setItem('drizaikn_user', JSON.stringify(data.user));
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

    // Store user in localStorage for persistence
    localStorage.setItem('drizaikn_user', JSON.stringify(data.user));
    return data.user;
  },

  logout(): void {
    localStorage.removeItem('drizaikn_user');
  },

  getCurrentUser(): AuthUser | null {
    const stored = localStorage.getItem('drizaikn_user');
    return stored ? JSON.parse(stored) : null;
  },

  updateStoredUser(user: Partial<AuthUser>): void {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...user };
      localStorage.setItem('drizaikn_user', JSON.stringify(updatedUser));
    }
  }
};
