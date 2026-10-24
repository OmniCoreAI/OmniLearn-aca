'use client'

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../locales/en.json';

const LOCALE_LOADERS: Record<string, () => Promise<{ default: any }>> = {
  fr: () => import('../locales/fr.json'),
  de: () => import('../locales/de.json'),
  es: () => import('../locales/es.json'),
  ar: () => import('../locales/ar.json'),
  ja: () => import('../locales/ja.json'),
  pt: () => import('../locales/pt.json'),
  ru: () => import('../locales/ru.json'),
  zh: () => import('../locales/zh.json'),
  hi: () => import('../locales/hi.json'),
  ko: () => import('../locales/ko.json'),
  it: () => import('../locales/it.json'),
  tr: () => import('../locales/tr.json'),
  vi: () => import('../locales/vi.json'),
  id: () => import('../locales/id.json'),
  pl: () => import('../locales/pl.json'),
  uk: () => import('../locales/uk.json'),
  nl: () => import('../locales/nl.json'),
  th: () => import('../locales/th.json'),
  bn: () => import('../locales/bn.json'),
  fa: () => import('../locales/fa.json'),
  sk: () => import('../locales/sk.json'),
};

// Only bundle English; lazy-load all other locales on demand
const resources = {
  en: { common: en },
};

async function loadLocale(lng: string) {
  const code = lng.split('-')[0]
  if (code === 'en' || !LOCALE_LOADERS[code]) return;
  if (i18n.hasResourceBundle(code, 'common')) return;

  try {
    const mod = await LOCALE_LOADERS[code]();
    i18n.addResourceBundle(code, 'common', mod.default, true, true);
  } catch (e) {
    console.warn(`Failed to load locale: ${lng}`, e);
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      order: ['localStorage', 'cookie', 'querystring', 'navigator', 'path', 'subdomain'],
      caches: ['localStorage', 'cookie'],
      lookupLocalStorage: 'i18nextLng',
      lookupCookie: 'i18next',
    },
    react: {
      useSuspense: false,
    }
  });

// Languages written right-to-left
export const RTL_LANGUAGES = ['ar', 'fa', 'he', 'ur']

export function isRTL(lng: string): boolean {
  return RTL_LANGUAGES.includes(lng.split('-')[0])
}

/**
 * Keep <html dir> and <html lang> in sync with the active language so the
 * whole site flips to RTL for Arabic/Persian and screen readers get the
 * right language.
 */
export function applyDocumentDirection(lng: string) {
  if (typeof document === 'undefined') return
  const code = lng.split('-')[0]
  document.documentElement.dir = isRTL(code) ? 'rtl' : 'ltr'
  document.documentElement.lang = code
}

i18n.on('languageChanged', applyDocumentDirection)
// Apply on first load (covers a saved Arabic preference)
applyDocumentDirection(i18n.language)

// Load the detected language if it's not English — export the promise
// so I18nProvider can wait for resources before rendering
export const initialLocaleReady = loadLocale(i18n.language.split('-')[0]);

export const USER_PICKED_LANG_KEY = 'i18nextLng_userPicked'

/**
 * Switch language safely — preloads the bundle before switching
 * so the UI never flashes English as a fallback.
 *
 * When markUserPicked is true (default), OrgLanguageSync will not
 * override the choice with the org default language.
 */
export async function changeLanguage(lng: string, options?: { markUserPicked?: boolean }) {
  const code = lng.split('-')[0]
  const markUserPicked = options?.markUserPicked !== false
  await loadLocale(code)

  if (typeof window !== 'undefined') {
    try {
      if (markUserPicked) {
        localStorage.setItem(USER_PICKED_LANG_KEY, '1')
      }
      localStorage.setItem('i18nextLng', code)
      // Keep cookie cache in sync with LanguageDetector lookupCookie
      document.cookie = `i18next=${encodeURIComponent(code)};path=/;max-age=31536000;SameSite=Lax`
    } catch {
      /* ignore storage / cookie failures */
    }
  }

  const result = await i18n.changeLanguage(code)
  applyDocumentDirection(code)
  return result
}

export default i18n;
