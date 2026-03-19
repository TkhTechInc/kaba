"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

export type Locale = "en" | "fr" | "yo" | "ha" | "ig" | "tw" | "wo";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  yo: "Yorùbá",
  ha: "Hausa",
  ig: "Igbo",
  tw: "Twi",
  wo: "Wolof",
};

const STORAGE_KEY = "kaba-locale";

// Messages are loaded lazily from JSON files to keep this file manageable.
// The JSON files live in /messages/{locale}.json and are imported at runtime.
// Auth + common + nav keys that don't yet have JSON files are inlined below.

const BASE_MESSAGES: Record<Locale, Record<string, unknown>> = {
  en: {
    auth: {
      signIn: "Sign In",
      signUp: "Sign Up",
      phoneNumber: "Phone number",
      verificationCode: "Verification code",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm password",
      sendOtp: "Send OTP",
      createAccount: "Create account",
      forgotPassword: "Forgot Password?",
    },
    common: {
      skipToContent: "Skip to main content",
      readAloud: "Read aloud",
      holdToSpeak: "Hold to speak",
      offline: "You are offline. Changes will sync when you reconnect.",
      loading: "Loading…",
      cancel: "Cancel",
      save: "Save",
      noData: "No data",
      loadMore: "Load more",
    },
    pos: {
      settingUp: "Setting up POS terminal…",
      error: "Error",
      backToInvoices: "Back to invoices",
      paymentNotReceived: "Payment not received",
      timeoutMessage: "10 minutes elapsed — try again or collect cash.",
      retryQr: "Retry (QR)",
      collectedCash: "Collected cash",
      paymentConfirmed: "Payment confirmed",
      printDownload: "Print / Download",
      receiptA4: "A4 Receipt (PDF)",
      thermalTicket: "Thermal ticket (72mm)",
      newTransaction: "New transaction",
      terminal: "POS Terminal",
      waitingForPayment: "Waiting for payment…",
      clientScansQr: "Customer scans the QR code to pay via Mobile Money",
      shareViaWhatsApp: "Share via WhatsApp",
      copyLink: "Copy link",
      linkCopied: "Link copied",
      or: "or",
      customerNoPhone: "Customer has no phone number. Add a phone number to share via WhatsApp.",
      customerNoPhoneLink: "Add phone in customer profile",
    },
  },
  fr: {
    auth: {
      signIn: "Connexion",
      signUp: "S'inscrire",
      phoneNumber: "Numéro de téléphone",
      verificationCode: "Code de vérification",
      email: "E-mail",
      password: "Mot de passe",
      confirmPassword: "Confirmer le mot de passe",
      sendOtp: "Envoyer le code",
      createAccount: "Créer un compte",
      forgotPassword: "Mot de passe oublié ?",
    },
    common: {
      skipToContent: "Aller au contenu principal",
      readAloud: "Lire à voix haute",
      holdToSpeak: "Appuyez pour parler",
      offline: "Vous êtes hors ligne. Les modifications seront synchronisées dès la reconnexion.",
      loading: "Chargement…",
      cancel: "Annuler",
      save: "Enregistrer",
      noData: "Aucune donnée",
      loadMore: "Charger plus",
    },
    pos: {
      settingUp: "Configuration du terminal POS…",
      error: "Erreur",
      backToInvoices: "Retour aux factures",
      paymentNotReceived: "Paiement non reçu",
      timeoutMessage: "10 minutes écoulées — réessayez ou encaissez en espèces.",
      retryQr: "Réessayer (QR)",
      collectedCash: "Encaissé en espèces",
      paymentConfirmed: "Paiement confirmé",
      printDownload: "Imprimer / Télécharger",
      receiptA4: "Reçu A4 (PDF)",
      thermalTicket: "Ticket thermique (72mm)",
      newTransaction: "Nouvelle transaction",
      terminal: "Terminal POS",
      waitingForPayment: "En attente de paiement…",
      clientScansQr: "Le client scanne le QR code pour payer par Mobile Money",
      shareViaWhatsApp: "Partager via WhatsApp",
      copyLink: "Copier le lien",
      linkCopied: "Lien copié",
      or: "ou",
      customerNoPhone: "Le client n'a pas de numéro. Ajoutez un numéro pour partager via WhatsApp.",
      customerNoPhoneLink: "Ajouter le téléphone dans le profil client",
    },
  },
  yo: {
    auth: {
      signIn: "Wọlé",
      signUp: "Forúkọsilẹ",
      phoneNumber: "Nọmba foonu",
      verificationCode: "Koodu ijẹrisi",
      email: "Imeeli",
      password: "Ọrọ aṣínà",
      confirmPassword: "Jẹrisi ọrọ aṣínà",
      sendOtp: "Firanṣẹ koodu",
      createAccount: "Ṣẹda akọọlẹ",
      forgotPassword: "Gbagbe ọrọ aṣínà?",
    },
    common: {
      skipToContent: "Lọ si akoonu akọkọ",
      readAloud: "Ka pẹ̀lú ohùn",
      holdToSpeak: "Mu lati sọrọ",
      offline: "O wa ni isinmi. Awọn ayipada yoo wa ni kika nigbati o tun sopọ.",
      loading: "Ń gba…",
      cancel: "Fagilee",
      save: "Fi pamọ",
      noData: "Ko si data",
      loadMore: "Gba diẹ sii",
    },
  },
  ha: {
    auth: {
      signIn: "Shiga",
      signUp: "Rajista",
      phoneNumber: "Lambar waya",
      verificationCode: "Lambar tabbatarwa",
      email: "Imel",
      password: "Kalmar sirri",
      confirmPassword: "Tabbatar da kalmar sirri",
      sendOtp: "Aika lamba",
      createAccount: "Ƙirƙiri asusun",
      forgotPassword: "Manta kalmar sirri?",
    },
    common: {
      skipToContent: "Tsallake zuwa babban abun ciki",
      readAloud: "Karanta da murya",
      holdToSpeak: "Riƙe don magana",
      offline: "Kuna kashe layi. Canje-canje za a sync lokacin da kuka sake haɗawa.",
      loading: "Ana lodi…",
      cancel: "Soke",
      save: "Ajiye",
      noData: "Babu bayani",
      loadMore: "Ƙara lodi",
    },
  },
  ig: {
    auth: {
      signIn: "Banye",
      signUp: "Debanye aha",
      phoneNumber: "Nọmba ekwentị",
      verificationCode: "Koodu nkwenye",
      email: "Ozi-e",
      password: "Okwuntughe",
      confirmPassword: "Kwenye okwuntughe",
      sendOtp: "Zipu koodu",
      createAccount: "Mepụta akaụntụ",
      forgotPassword: "Chefuo okwuntughe?",
    },
    common: {
      skipToContent: "Wụga na ọdịnaya bụ isi",
      readAloud: "Gụọ olu",
      holdToSpeak: "Jide ịgwa okwu",
      offline: "Ị dị na mpụga. Mgbanwe ga-emekọ ihe mgbe i jikọọ ọzọ.",
      loading: "Na-ebu…",
      cancel: "Kagbuo",
      save: "Chekwa",
      noData: "Enweghị data",
      loadMore: "Budata ọzọ",
    },
  },
  tw: {
    auth: {
      signIn: "Wo kɔ mu",
      signUp: "Kɔ w'ase",
      phoneNumber: "Fon nɔma",
      verificationCode: "Nhwehwɛmu kɔd",
      email: "Email",
      password: "Gyinae",
      confirmPassword: "Gyinae hwɛ",
      sendOtp: "Kɔd kɔ",
      createAccount: "Yɛ akaunti",
      forgotPassword: "Wó gyinae wó?",
    },
    common: {
      skipToContent: "Kɔ nkyerɛwee mu",
      readAloud: "Kenkan",
      holdToSpeak: "Di so na kasa",
      offline: "Wo wɔ offline. Foforo bɛhyia biom a wobɛkɔ online.",
      loading: "Kɔ so…",
      cancel: "Gyae",
      save: "Sie",
      noData: "Ɛnni data",
      loadMore: "Fa biara",
    },
  },
  wo: {
    auth: {
      signIn: "Dugg",
      signUp: "Bindu",
      phoneNumber: "Nimeero telefon",
      verificationCode: "Kodu xam-xam",
      email: "Iméel",
      password: "Mot de passe",
      confirmPassword: "Seetlu mot de passe",
      sendOtp: "Yónni kodu",
      createAccount: "Def konte",
      forgotPassword: "Xamul mot de passe?",
    },
    common: {
      skipToContent: "Dem ci biir",
      readAloud: "Jàng ak dëkk",
      holdToSpeak: "Amul kàddu",
      offline: "Dafa metti Internet. Ci kanam, dina sync seppo bu reental.",
      loading: "Yégël…",
      cancel: "Dëkkal",
      save: "Dox",
      noData: "Amul données",
      loadMore: "Yëgël ëllëg",
    },
  },
};

// Full messages (EN + FR) are loaded from JSON. Other locales fall back to EN for keys not yet translated.
async function loadMessages(): Promise<Record<Locale, Record<string, unknown>>> {
  const [en, fr] = await Promise.all([
    import("../../messages/en.json").then((m) => m.default),
    import("../../messages/fr.json").then((m) => m.default),
  ]);
  return {
    en: deepMerge(BASE_MESSAGES.en, en as Record<string, unknown>),
    fr: deepMerge(BASE_MESSAGES.fr, fr as Record<string, unknown>),
    yo: deepMerge(BASE_MESSAGES.yo, en as Record<string, unknown>),
    ha: deepMerge(BASE_MESSAGES.ha, en as Record<string, unknown>),
    ig: deepMerge(BASE_MESSAGES.ig, en as Record<string, unknown>),
    tw: deepMerge(BASE_MESSAGES.tw, en as Record<string, unknown>),
    wo: deepMerge(BASE_MESSAGES.wo, en as Record<string, unknown>),
  };
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const b = base[key];
    const o = override[key];
    if (b && o && typeof b === "object" && typeof o === "object" && !Array.isArray(b)) {
      result[key] = deepMerge(b as Record<string, unknown>, o as Record<string, unknown>);
    } else {
      result[key] = o;
    }
  }
  return result;
}

// Sync fallback used before async load completes
const messages: Record<Locale, Record<string, unknown>> = BASE_MESSAGES;

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return typeof current === "string" ? current : undefined;
}

/** Interpolate {variable} placeholders in a message string. */
function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

function getMsg(
  locale: Locale,
  loaded: Record<Locale, Record<string, unknown>>,
  key: string,
  vars?: Record<string, string | number>,
): string {
  // Try current locale, fall back to EN
  const val =
    getNested(loaded[locale] as Record<string, unknown>, key) ??
    getNested(loaded.en as Record<string, unknown>, key);
  return val ? interpolate(val, vars) : key;
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate a dot-notation key with optional interpolation vars. */
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [loaded, setLoaded] = useState<Record<Locale, Record<string, unknown>>>(messages);

  useEffect(() => {
    // Restore saved locale
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && stored in LOCALE_LABELS) setLocaleState(stored);
    } catch { /* ignore */ }

    // Load full message files
    loadMessages().then(setLoaded).catch(() => { /* fall back to base */ });
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      // Also set cookie so server components pick it up on next request
      document.cookie = `locale=${l};path=/;max-age=31536000;SameSite=Lax`;
    } catch { /* ignore */ }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => getMsg(locale, loaded, key, vars),
    [locale, loaded],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: "en" as Locale,
      setLocale: (_l: Locale) => {},
      t: (key: string) => key,
    };
  }
  return ctx;
}
