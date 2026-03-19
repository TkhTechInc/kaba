/**
 * Multi-language email templates for transactional emails.
 * Locale derived from Accept-Language header or user preference.
 * Supports: en (English), fr (French) — primary for West Africa.
 */

export type EmailLocale = 'en' | 'fr';

export interface WelcomeEmailData {
  userName?: string;
  dashboardUrl: string;
}

export interface VerificationEmailData {
  code: string;
  expiresMinutes: number;
}

export interface PasswordResetEmailData {
  resetLink: string;
  expiresMinutes: number;
}

export interface InvitationEmailData {
  businessName: string;
  role: string;
  inviteLink: string;
  expiresDays: number;
}

const TEMPLATES = {
  en: {
    welcome: {
      subject: 'Welcome to Kaba — Your accounting companion',
      greeting: (name?: string) => (name ? `Hello ${name},` : 'Hello,'),
      body: `Thank you for joining Kaba. We're here to help you manage your business finances with ease.

Get started by exploring your dashboard — record sales, track expenses, create invoices, and stay on top of your cash flow.

We built Kaba for small businesses across West Africa. If you have questions, our support team is here to help.`,
      cta: 'Go to Dashboard',
      footer: 'Kaba — Simple accounting for growing businesses',
    },
    verification: {
      subject: 'Your Kaba verification code',
      body: (code: string, expires: number) =>
        `Your verification code is: ${code}\n\nThis code expires in ${expires} minutes. Do not share it with anyone.`,
    },
    passwordReset: {
      subject: 'Reset your Kaba password',
      body: (link: string, expires: number) =>
        `You requested a password reset. Click the link below to set a new password:\n\n${link}\n\nThis link expires in ${expires} minutes. If you didn't request this, you can safely ignore this email.`,
    },
    invitation: {
      subject: (business: string) => `You're invited to join ${business}`,
      body: (business: string, role: string, link: string, days: number) =>
        `You've been invited to join ${business} as ${role}. Click the link below to accept:\n\n${link}\n\nThis link expires in ${days} days.`,
    },
  },
  fr: {
    welcome: {
      subject: 'Bienvenue sur Kaba — Votre compagnon comptable',
      greeting: (name?: string) => (name ? `Bonjour ${name},` : 'Bonjour,'),
      body: `Merci d'avoir rejoint Kaba. Nous sommes là pour vous aider à gérer facilement les finances de votre entreprise.

Commencez par explorer votre tableau de bord — enregistrez les ventes, suivez les dépenses, créez des factures et gardez le contrôle de votre trésorerie.

Nous avons créé Kaba pour les petites entreprises en Afrique de l'Ouest. Si vous avez des questions, notre équipe support est à votre disposition.`,
      cta: 'Accéder au tableau de bord',
      footer: 'Kaba — Comptabilité simple pour les entreprises en croissance',
    },
    verification: {
      subject: 'Votre code de vérification Kaba',
      body: (code: string, expires: number) =>
        `Votre code de vérification est : ${code}\n\nCe code expire dans ${expires} minutes. Ne le partagez avec personne.`,
    },
    passwordReset: {
      subject: 'Réinitialisez votre mot de passe Kaba',
      body: (link: string, expires: number) =>
        `Vous avez demandé une réinitialisation de mot de passe. Cliquez sur le lien ci-dessous pour en définir un nouveau :\n\n${link}\n\nCe lien expire dans ${expires} minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.`,
    },
    invitation: {
      subject: (business: string) => `Vous êtes invité à rejoindre ${business}`,
      body: (business: string, role: string, link: string, days: number) =>
        `Vous avez été invité à rejoindre ${business} en tant que ${role}. Cliquez sur le lien ci-dessous pour accepter :\n\n${link}\n\nCe lien expire dans ${days} jours.`,
    },
  },
} as const;

/**
 * Parse Accept-Language header to get preferred locale (en or fr).
 * Example: "en-US,en;q=0.9,fr;q=0.8" -> "en"
 */
export function parseEmailLocale(acceptLanguage?: string): EmailLocale {
  if (!acceptLanguage?.trim()) return 'en';
  const parts = acceptLanguage.split(',').map((p) => p.trim().split(';')[0].toLowerCase().slice(0, 2));
  for (const p of parts) {
    if (p === 'fr') return 'fr';
    if (p === 'en') return 'en';
  }
  return 'en';
}

export function getEmailTemplates(locale: EmailLocale = 'en') {
  return TEMPLATES[locale] ?? TEMPLATES.en;
}

/**
 * Build professional HTML email wrapper with inline styles for compatibility.
 */
export function buildHtmlEmail(options: {
  preheader?: string;
  title: string;
  greeting: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaText?: string;
  footer: string;
}): string {
  const { preheader, title, greeting, bodyHtml, ctaUrl, ctaText, footer } = options;
  const ctaBlock = ctaUrl && ctaText
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
      <tr>
        <td>
          <a href="${ctaUrl}" style="display: inline-block; padding: 14px 28px; background-color: #0095ff; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">${ctaText}</a>
        </td>
      </tr>
    </table>
  `
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  ${preheader ? `<meta name="description" content="${preheader.replace(/"/g, '&quot;')}">` : ''}
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #1a1a1a; background-color: #f4f4f5;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden;">
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 24px; font-size: 18px; font-weight: 600; color: #0095ff;">Kaba</p>
              <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 700; color: #1a1a1a;">${title}</h1>
              <p style="margin: 0 0 16px;">${greeting}</p>
              <div style="margin: 0 0 24px; color: #4a4a4a;">
                ${bodyHtml}
              </div>
              ${ctaBlock}
              <p style="margin: 32px 0 0; font-size: 13px; color: #8a8a8a;">${footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Convert plain text with newlines to HTML paragraphs.
 */
export function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => `<p style="margin: 0 0 12px;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
