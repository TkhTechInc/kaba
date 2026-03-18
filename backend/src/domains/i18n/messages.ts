/**
 * Backend i18n messages for WhatsApp, Telegram, and agent responses
 * Supports English (en) and French (fr)
 */

export type SupportedLocale = 'en' | 'fr';

export interface Messages {
  whatsapp: {
    welcome: string;
    linkPrompt: string;
    linkSuccess: string;
    linkFailed: string;
    accountNotFound: string;
    voiceTranscriptionFailed: string;
    examples: string[];
  };
  dailySummary: {
    title: string;
    date: string;
    sales: string;
    expenses: string;
    profit: string;
    debts: string;
  };
  paymentReminder: {
    reminder: string;
    owes: string;
    due: string;
    pleasePayMessage: string;
  };
  agent: {
    balance: string;
    createInvoice: string;
    recordSale: string;
    recordExpense: string;
    unpaidInvoices: string;
    debtReminder: string;
    error: string;
  };
}

export const messages: Record<SupportedLocale, Messages> = {
  en: {
    whatsapp: {
      welcome: 'Welcome to Kaba! Your account is not linked to this chat.',
      linkPrompt:
        'To get started:\n1. Create an account at app.kaba.dev\n2. Reply: LINK <your email>\n   (If you have multiple businesses: LINK <email> <businessId>)\n\nExample: LINK amara@gmail.com',
      linkSuccess:
        'Linked! Your Kaba account is now connected.\n\nYou can now ask me:\n• "Check my balance"\n• "I sold 3 bags of rice for 45,000"\n• "Who owes me money?"\n• "Send reminder to Moussa"\n• "My daily summary"',
      linkFailed: 'No Kaba account found for {email}.\n\nSign up at app.kaba.dev, then try: LINK {email}',
      accountNotFound: 'Account not found',
      voiceTranscriptionFailed:
        'Sorry, I could not understand the voice message. Please try typing your message.',
      examples: [
        'Check my balance',
        'I sold 3 bags of rice for 45,000',
        'Who owes me money?',
        'Send reminder to Moussa',
        'My daily summary',
      ],
    },
    dailySummary: {
      title: 'Daily Summary — Kaba AI',
      date: 'Date',
      sales: 'Sales',
      expenses: 'Expenses',
      profit: 'Profit',
      debts: 'Outstanding debts',
    },
    paymentReminder: {
      reminder: 'Reminder',
      owes: 'owes',
      due: 'Due',
      pleasePayMessage: 'Please pay at your earliest convenience.',
    },
    agent: {
      balance: 'Your current balance is {currency} {amount}.',
      createInvoice: 'Invoice created successfully. ID: {invoiceId}',
      recordSale: 'Sale recorded: {currency} {amount}',
      recordExpense: 'Expense recorded: {currency} {amount}',
      unpaidInvoices: 'You have {count} unpaid invoices totaling {currency} {amount}.',
      debtReminder: 'Reminder sent to {name}',
      error: 'Sorry, an error occurred. Please try again.',
    },
  },
  fr: {
    whatsapp: {
      welcome: 'Bienvenue sur Kaba ! Votre compte n\'est pas lié à cette discussion.',
      linkPrompt:
        'Pour commencer :\n1. Créez un compte sur app.kaba.dev\n2. Répondez : LINK <votre email>\n   (Si vous avez plusieurs entreprises : LINK <email> <businessId>)\n\nExemple : LINK amara@gmail.com',
      linkSuccess:
        'Lié ! Votre compte Kaba est maintenant connecté.\n\nVous pouvez maintenant me demander :\n• "Vérifie mon solde"\n• "J\'ai vendu 3 sacs de riz pour 45 000"\n• "Qui me doit de l\'argent ?"\n• "Envoie un rappel à Moussa"\n• "Mon résumé quotidien"',
      linkFailed:
        'Aucun compte Kaba trouvé pour {email}.\n\nInscrivez-vous sur app.kaba.dev, puis essayez : LINK {email}',
      accountNotFound: 'Compte non trouvé',
      voiceTranscriptionFailed:
        'Désolé, je n\'ai pas pu comprendre le message vocal. Veuillez taper votre message.',
      examples: [
        'Vérifie mon solde',
        'J\'ai vendu 3 sacs de riz pour 45 000',
        'Qui me doit de l\'argent ?',
        'Envoie un rappel à Moussa',
        'Mon résumé quotidien',
      ],
    },
    dailySummary: {
      title: 'Résumé du jour — Kaba AI',
      date: 'Date',
      sales: 'Ventes',
      expenses: 'Dépenses',
      profit: 'Profit',
      debts: 'Dettes en attente',
    },
    paymentReminder: {
      reminder: 'Rappel',
      owes: 'doit',
      due: 'Échéance',
      pleasePayMessage: 'Veuillez payer dès que possible.',
    },
    agent: {
      balance: 'Votre solde actuel est de {currency} {amount}.',
      createInvoice: 'Facture créée avec succès. ID : {invoiceId}',
      recordSale: 'Vente enregistrée : {currency} {amount}',
      recordExpense: 'Dépense enregistrée : {currency} {amount}',
      unpaidInvoices: 'Vous avez {count} factures impayées pour un total de {currency} {amount}.',
      debtReminder: 'Rappel envoyé à {name}',
      error: 'Désolé, une erreur s\'est produite. Veuillez réessayer.',
    },
  },
};

/**
 * Simple template replacement: replaces {key} with values from params
 */
export function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
}

/**
 * Get messages for a given locale, fallback to English if not found
 */
export function getMessages(locale?: string): Messages {
  const normalizedLocale = (locale?.toLowerCase().slice(0, 2) ?? 'en') as SupportedLocale;
  return messages[normalizedLocale] ?? messages.en;
}
