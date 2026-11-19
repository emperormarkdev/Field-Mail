import type { EmailProvider, Settings } from '../types';

export interface EmailProviderPreset {
  id: EmailProvider;
  label: string;
  host: string;
  port: number;
  passwordLabel: string;
  passwordPlaceholder: string;
  helpUrl?: string;
  helpLabel?: string;
}

export const EMAIL_PROVIDERS: EmailProviderPreset[] = [
  {
    id: 'auto',
    label: 'Auto-detect',
    host: '',
    port: 465,
    passwordLabel: 'Email / App Password',
    passwordPlaceholder: 'Your email password or App Password',
  },
  {
    id: 'gmail',
    label: 'Gmail / Google',
    host: 'smtp.gmail.com',
    port: 465,
    passwordLabel: 'Gmail App Password',
    passwordPlaceholder: 'xxxx xxxx xxxx xxxx',
    helpUrl: 'https://myaccount.google.com/apppasswords',
    helpLabel: 'Get a 16-letter App Password from Google',
  },
  {
    id: 'outlook',
    label: 'Outlook / 365',
    host: 'smtp.office365.com',
    port: 587,
    passwordLabel: 'Email / App Password',
    passwordPlaceholder: 'Your Outlook or App Password',
    helpUrl: 'https://account.microsoft.com/security',
    helpLabel: 'Manage Microsoft security & App Passwords',
  },
  {
    id: 'yahoo',
    label: 'Yahoo Mail',
    host: 'smtp.mail.yahoo.com',
    port: 465,
    passwordLabel: 'Yahoo App Password',
    passwordPlaceholder: 'Your Yahoo App Password',
    helpUrl: 'https://login.yahoo.com/myaccount/security/app-password',
    helpLabel: 'Generate a Yahoo App Password',
  },
  {
    id: 'zoho',
    label: 'Zoho Mail',
    host: 'smtp.zoho.com',
    port: 465,
    passwordLabel: 'Zoho App Password',
    passwordPlaceholder: 'Your Zoho App Password',
    helpUrl: 'https://accounts.zoho.com/home#security/security_pwd',
    helpLabel: 'Create a Zoho App Password',
  },
  {
    id: 'proton',
    label: 'Proton Mail',
    host: 'smtp.protonmail.ch',
    port: 587,
    passwordLabel: 'Proton SMTP Token',
    passwordPlaceholder: 'Your Proton SMTP token',
    helpUrl: 'https://account.proton.me/u/0/mail/imap-smtp',
    helpLabel: 'Create a Proton SMTP token (paid plans)',
  },
  {
    id: 'custom',
    label: 'Custom server',
    host: '',
    port: 465,
    passwordLabel: 'Email / SMTP Password',
    passwordPlaceholder: 'Your email password or SMTP key',
  },
];

export function getProviderPreset(provider?: EmailProvider): EmailProviderPreset {
  return EMAIL_PROVIDERS.find((item) => item.id === provider) ?? EMAIL_PROVIDERS[0];
}

export function inferProviderFromEmail(email: string): EmailProvider | null {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return null;
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail';
  if (
    domain === 'outlook.com' ||
    domain === 'hotmail.com' ||
    domain === 'live.com' ||
    domain === 'msn.com'
  ) {
    return 'outlook';
  }
  if (domain === 'yahoo.com' || domain.startsWith('yahoo.') || domain === 'ymail.com') {
    return 'yahoo';
  }
  if (domain === 'zoho.com' || domain === 'zohomail.com') return 'zoho';
  if (domain === 'proton.me' || domain === 'protonmail.com' || domain === 'pm.me') {
    return 'proton';
  }
  return null;
}

export function resolveSmtpConfig(settings: Pick<Settings, 'emailProvider' | 'smtpHost' | 'smtpPort'>): {
  smtpHost?: string;
  smtpPort?: number;
} {
  const provider = settings.emailProvider ?? 'auto';
  if (provider === 'auto') {
    return { smtpHost: undefined, smtpPort: undefined };
  }
  if (provider === 'custom') {
    const host = (settings.smtpHost ?? '').trim().toLowerCase();
    const port = settings.smtpPort === 587 || settings.smtpPort === 2525 ? settings.smtpPort : 465;
    return { smtpHost: host || undefined, smtpPort: host ? port : undefined };
  }
  const preset = getProviderPreset(provider);
  return { smtpHost: preset.host, smtpPort: preset.port };
}
