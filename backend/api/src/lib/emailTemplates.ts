import type { EmailTemplate } from '../../generated/prisma/client.js';

type RenderResult = {
  subject: string;
  html: string;
};

type VerificationPayload = {
  token: string;
};

type ResetPayload = {
  token: string;
};

const APP_SCHEME = process.env.MOBILE_SCHEME || 'nodesocial';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://node-social.com';

const styles = {
  wrapper:
    "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1E293B; max-width: 600px; margin: 0 auto; padding: 20px;",
  hero:
    "background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;",
  heroTitle: "color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 700;",
  card:
    "background: #FFFFFF; padding: 40px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;",
  heading: "color: #1E293B; margin-top: 0; font-size: 24px; font-weight: 600;",
  body: "color: #64748B; font-size: 16px;",
  buttonWrapper: "text-align: center; margin: 32px 0;",
  button:
    "display: inline-block; background: #2563EB; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;",
  footer:
    "color: #94A3B8; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #E2E8F0;",
  tokenBox:
    "color: #94A3B8; font-size: 12px; margin-top: 16px; background: #F1F5F9; padding: 12px; border-radius: 6px;",
  token:
    "color: #1E293B; font-family: monospace; word-break: break-all;",
};

function wrapTemplate(heading: string, body: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${styles.wrapper}">
        <div style="${styles.hero}">
          <h1 style="${styles.heroTitle}">Node Social</h1>
        </div>
        <div style="${styles.card}">
          <h2 style="${styles.heading}">${heading}</h2>
          ${body}
        </div>
      </body>
    </html>
  `;
}

function renderVerificationEmail(payload: VerificationPayload): RenderResult {
  const deepLinkUrl = `${APP_SCHEME}://verify-email?token=${payload.token}`;
  const webUrl = `${FRONTEND_URL}/verify-email?token=${payload.token}`;

  const body = `
    <p style="${styles.body}">Thanks for signing up! Please verify your email address to complete your registration. Tap the button below on your device:</p>
    <div style="${styles.buttonWrapper}">
      <a href="${deepLinkUrl}" style="${styles.button}">Verify Email in App</a>
    </div>
    <p style="${styles.footer}">If the button doesn't open the app, copy this link: <a href="${webUrl}">${webUrl}</a></p>
    <p style="${styles.tokenBox}">You can also copy this token and paste it inside the app:<br><strong style="${styles.token}">${payload.token}</strong></p>
  `;

  return {
    subject: 'Verify your Node Social email',
    html: wrapTemplate('Verify your email address', body),
  };
}

function renderPasswordResetEmail(payload: ResetPayload): RenderResult {
  const deepLinkUrl = `${APP_SCHEME}://reset-password?token=${payload.token}`;
  const webUrl = `${FRONTEND_URL}/reset-password?token=${payload.token}`;

  const body = `
    <p style="${styles.body}">You requested to reset your password. Tap the button below to open the app and choose a new password:</p>
    <div style="${styles.buttonWrapper}">
      <a href="${deepLinkUrl}" style="${styles.button}">Reset Password in App</a>
    </div>
    <p style="${styles.footer}">If you didn't request this, you can safely ignore this email. The link expires in 1 hour. Web fallback: <a href="${webUrl}">${webUrl}</a></p>
    <p style="${styles.tokenBox}">Need to enter the token manually? Use this code:<br><strong style="${styles.token}">${payload.token}</strong></p>
  `;

  return {
    subject: 'Reset your Node Social password',
    html: wrapTemplate('Reset your password', body),
  };
}

export function renderEmailFromTemplate(
  template: EmailTemplate,
  payload: unknown
): RenderResult {
  switch (template) {
    case 'VERIFICATION':
      return renderVerificationEmail(payload as VerificationPayload);
    case 'PASSWORD_RESET':
      return renderPasswordResetEmail(payload as ResetPayload);
    default:
      throw new Error(`Unsupported email template: ${template}`);
  }
}

