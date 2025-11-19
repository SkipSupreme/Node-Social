// src/lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, verificationToken: string) {
  // Use deep link for mobile app
  const deepLinkUrl = `nodesocial://verify-email?token=${verificationToken}`;
  // Also provide web fallback for testing
  const webUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Verify your Node Social email',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1E293B; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 700;">Welcome to Node Social</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1E293B; margin-top: 0; font-size: 24px; font-weight: 600;">Verify your email address</h2>
              <p style="color: #64748B; font-size: 16px;">Thanks for signing up! Please verify your email address to complete your registration. Click the button below to verify:</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${deepLinkUrl}" style="display: inline-block; background: #2563EB; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Verify Email in App</a>
              </div>
              <p style="color: #94A3B8; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #E2E8F0;">If you didn't create an account, you can safely ignore this email.</p>
              <p style="color: #94A3B8; font-size: 12px; margin-top: 16px; background: #F1F5F9; padding: 12px; border-radius: 6px;">If the app doesn't open, copy this token and enter it manually in the app:<br><strong style="color: #1E293B; font-family: monospace; word-break: break-all;">${verificationToken}</strong></p>
            </div>
          </body>
        </html>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  // Use deep link for mobile app
  const deepLinkUrl = `nodesocial://reset-password?token=${resetToken}`;
  // Also provide web fallback for testing
  const webUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Reset your Node Social password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1E293B; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 700;">Node Social</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1E293B; margin-top: 0; font-size: 24px; font-weight: 600;">Reset your password</h2>
              <p style="color: #64748B; font-size: 16px;">You requested to reset your password. Click the button below to open the app and create a new password:</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${deepLinkUrl}" style="display: inline-block; background: #2563EB; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password in App</a>
              </div>
              <p style="color: #94A3B8; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #E2E8F0;">If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.</p>
              <p style="color: #94A3B8; font-size: 12px; margin-top: 16px; background: #F1F5F9; padding: 12px; border-radius: 6px;">If the app doesn't open, copy this token and enter it manually in the app:<br><strong style="color: #1E293B; font-family: monospace; word-break: break-all;">${resetToken}</strong></p>
            </div>
          </body>
        </html>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

