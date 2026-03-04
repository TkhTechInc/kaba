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

const messages: Record<Locale, Record<string, unknown>> = {
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
    },
    nav: {
      dashboard: "Dashboard",
      invoices: "Invoices",
      customers: "Customers",
      ledger: "Ledger",
      receipts: "Receipts",
      reports: "Reports",
      settings: "Settings",
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
    },
    nav: {
      dashboard: "Tableau de bord",
      invoices: "Factures",
      customers: "Clients",
      ledger: "Livre de comptes",
      receipts: "Reçus",
      reports: "Rapports",
      settings: "Paramètres",
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
    },
    nav: {
      dashboard: "Dashibodu",
      invoices: "Iwe-ìdánilójú",
      customers: "Awọn onibara",
      ledger: "Iwe iṣiro",
      receipts: "Awọn resiiti",
      reports: "Awọn iroyin",
      settings: "Eto",
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
    },
    nav: {
      dashboard: "Allon sarrafawa",
      invoices: "Kudaden fito",
      customers: "Abokan ciniki",
      ledger: "Littafin lissafi",
      receipts: "Takaddun karɓa",
      reports: "Rahotanni",
      settings: "Saitunan",
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
    },
    nav: {
      dashboard: "Ikpuike",
      invoices: "Ụgwọ",
      customers: "Ndị ahịa",
      ledger: "Akwụkwọ ọnụ ego",
      receipts: "Ọnụ ego natara",
      reports: "Akụkọ",
      settings: "Ntọala",
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
    },
    nav: {
      dashboard: "Dashboard",
      invoices: "Invoice",
      customers: "Adesua",
      ledger: "Nkontaabu",
      receipts: "Receipt",
      reports: "Nnwuma nhyehyɛe",
      settings: "Nsisie",
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
    },
    nav: {
      dashboard: "Taabloo",
      invoices: "Faktiir",
      customers: "Kliyaan",
      ledger: "Réegistre",
      receipts: "Resiiy",
      reports: "Raporr",
      settings: "Parameetri",
    },
  },
};

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return typeof current === "string" ? current : undefined;
}

function getMsg(locale: Locale, key: string): string {
  const val = getNested(messages[locale] as unknown as Record<string, unknown>, key);
  return val ?? key;
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && stored in LOCALE_LABELS) setLocaleState(stored);
    } catch {
      // ignore
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback((key: string) => getMsg(locale, key), [locale]);

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
      setLocale: () => {},
      t: (key: string) => key,
    };
  }
  return ctx;
}
