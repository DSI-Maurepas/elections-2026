// src/services/authService.js
// Service d'authentification OAuth 2.0 pour Google Sheets API

import { GOOGLE_SHEETS, LOCAL_STORAGE_KEYS } from '../utils/constants';

let __gisInteractiveInFlight = false; // empêche l'ouverture de popups multiples

// --- Auth Admin (mot de passe local) ---
// NOTE: Auth "Administration" volontairement locale (pas Google OAuth). Usage interne jour J.
// Stockage: localStorage (session persistante dans le navigateur).
const ADMIN_STORAGE_KEY = 'elections_admin_auth_v1';
const ADMIN_PASSWORD = 'Elections@M0rep@$';


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
   * Déconnexion
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
   * Vérifie si l'utilisateur est authentifié
   */
  isAuthenticated() {
    const token = localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
    const expiresAt = localStorage.getItem('auth_token_expires_at');
    
    if (!token || !expiresAt) return false;
    
    // Vérifier l'expiration
    if (Date.now() > parseInt(expiresAt)) {
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
    const timeUntilExpiry = parseInt(expiresAt) - now;
    
    // Rafraîchir si expire dans moins de 5 minutes
    if (timeUntilExpiry < 5 * 60 * 1000) {
      try {
        await this.signIn();
      } catch (error) {
        console.error('Erreur lors du rafraîchissement du token:', error);
        throw error;
      }
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

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des informations utilisateur');
      }

      const userInfo = await response.json();
      localStorage.setItem(LOCAL_STORAGE_KEYS.USER_EMAIL, userInfo.email);
      return userInfo;
    } catch (error) {
      console.error('Erreur getUserInfo:', error);
      throw error;
    }
  }

  /**
   * Récupère l'email de l'utilisateur
   */

  // =========================
  // Auth Administration (mot de passe)
  // =========================

  /**
   * Connecte l'utilisateur à l'espace Administration via mot de passe.
   * @param {string} password
   * @returns {boolean} true si OK
   */
  adminSignIn(password) {
    const ok = typeof password === 'string' && password === ADMIN_PASSWORD;
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

  getUserEmail() {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.USER_EMAIL) || 'utilisateur@inconnu.com';
  }
}

// Instance singleton
export default new AuthService();