// src/services/authService.js
// Service d'authentification OAuth 2.0 pour Google Sheets API
// + Gestion d'accès applicatif (BV / Global / Admin) via code, stocké en localStorage (jour J)

import { GOOGLE_SHEETS, LOCAL_STORAGE_KEYS } from '../utils/constants';
import { ACCESS_CONFIG, parseAccessCode } from '../config/authConfig.js';

// --- Accès applicatif (BV / Global / Admin) ---
// Stockage: localStorage (session persistante dans le navigateur).
const ACCESS_STORAGE_KEY = 'elections_access_v1';

// --- Auth Admin (mot de passe local) ---
// Compat V3: l'espace Administration est déverrouillé via un mot de passe.
const ADMIN_STORAGE_KEY = 'elections_admin_auth_v1';

class AuthService {
  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    this.scopes = GOOGLE_SHEETS.SCOPES.join(' ');
    this.tokenClient = null;
    this.accessToken = null;
  }

  /**
   * Initialise le client OAuth 2.0
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: this.scopes,
          callback: (response) => {
            if (response.error) {
              reject(response);
              return;
            }
            this.handleAuthResponse(response);
            resolve(response);
          },
        });
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Déclenche le flux d'authentification
   */
  async signIn() {
    if (!this.tokenClient) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      try {
        this.tokenClient.callback = (response) => {
          if (response.error) {
            reject(response);
            return;
          }
          this.handleAuthResponse(response);
          resolve(response);
        };

        this.tokenClient.requestAccessToken({ prompt: '' });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Gère la réponse d'authentification
   */
  handleAuthResponse(response) {
    this.accessToken = response.access_token;

    // Stocker le token (attention: localStorage non sécurisé pour prod)
    localStorage.setItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN, response.access_token);

    // Stocker l'expiration
    const expiresIn = response.expires_in || 3600;
    const expiresAt = Date.now() + (expiresIn * 1000);
    localStorage.setItem('auth_token_expires_at', expiresAt.toString());
  }

  /**
   * Déconnexion OAuth
   */
  signOut() {
    const token = this.accessToken || localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);

    if (token && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(token);
    }

    this.accessToken = null;
    localStorage.removeItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem('auth_token_expires_at');
    localStorage.removeItem(LOCAL_STORAGE_KEYS.USER_EMAIL);
  }

  /**
   * Vérifie si l'utilisateur est authentifié OAuth
   */
  isAuthenticated() {
    const token = localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
    const expiresAt = localStorage.getItem('auth_token_expires_at');

    if (!token || !expiresAt) return false;

    // Vérifier l'expiration
    if (Date.now() > parseInt(expiresAt, 10)) {
      this.signOut();
      return false;
    }

    this.accessToken = token;
    return true;
  }

  /**
   * Récupère le token d'accès actuel
   */
  getAccessToken() {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.accessToken || localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
  }

  /**
   * Rafraîchit le token si nécessaire
   */
  async refreshTokenIfNeeded() {
    const expiresAt = localStorage.getItem('auth_token_expires_at');

    if (!expiresAt) return;

    const now = Date.now();
    const timeUntilExpiry = parseInt(expiresAt, 10) - now;

    // Rafraîchir si expire dans moins de 5 minutes
    if (timeUntilExpiry < 5 * 60 * 1000) {
      await this.signIn();
    }
  }

  /**
   * Récupère les informations de l'utilisateur connecté
   */
  async getUserInfo() {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Non authentifié');
    }

    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des informations utilisateur");
    }

    const userInfo = await response.json();
    localStorage.setItem(LOCAL_STORAGE_KEYS.USER_EMAIL, userInfo.email);
    return userInfo;
  }

  /**
   * Récupère l'email de l'utilisateur
   */
  getUserEmail() {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.USER_EMAIL) || 'utilisateur@inconnu.com';
  }

  // =========================
  // Auth Administration (mot de passe)
  // =========================

  /**
   * Connecte l'utilisateur à l'espace Administration via mot de passe.
   * @param {string} password
   * @returns {boolean} true si OK
   */
  adminSignIn(password) {
    const ok = typeof password === 'string' && password === ACCESS_CONFIG.ADMIN_PASSWORD;
    if (ok) {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ ok: true, ts: Date.now() }));
    }
    return ok;
  }

  /**
   * Déconnecte l'utilisateur de l'espace Administration.
   */
  adminSignOut() {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  }

  /**
   * Indique si l'utilisateur est connecté à l'espace Administration.
   * @returns {boolean}
   */
  isAdminSignedIn() {
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!parsed?.ok;
    } catch {
      return false;
    }
  }
}

// =========================
// Accès applicatif (BV / GLOBAL / ADMIN)
// =========================

/**
 * Login applicatif par code (BVx / Global / Admin).
 * @param {string} code
 * @returns {{role:'BV'|'GLOBAL'|'ADMIN', bureauId?:number}|null}
 */
export function loginWithCode(code) {
  const auth = parseAccessCode(code);
  if (!auth) return null;
  localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify({ ...auth, ts: Date.now() }));
  return auth;
}

/**
 * Etat d'accès applicatif courant.
 * @returns {{role:'BV'|'GLOBAL'|'ADMIN', bureauId?:number}|null}
 */
export function getAuthState() {
  try {
    const raw = localStorage.getItem(ACCESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function logoutAccess() {
  localStorage.removeItem(ACCESS_STORAGE_KEY);
  // on ne touche pas au token OAuth ici (décision volontaire)
}

export function clearAllSessions() {
  logoutAccess();
  localStorage.removeItem(ADMIN_STORAGE_KEY);
  try {
    authService.signOut();
  } catch {
    // noop
  }
}

// Helpers attendus par les composants (Participation / Résultats)
export function isBV(auth) {
  return auth?.role === 'BV';
}
export function isGlobal(auth) {
  return auth?.role === 'GLOBAL';
}
export function isAdmin(auth) {
  return auth?.role === 'ADMIN';
}

// Instance singleton OAuth (compat V3)
const authService = new AuthService();
export default authService;
