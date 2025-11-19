# Environment Setup Guide

## Backend Environment Variables

Create a `.env` file in `backend/api/` with the following:

```bash
# JWT Secret - Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=5beb2844c1dfc9cc674199205ac0245e29add2cf9206dbdac24d56162e78f2b01371babea2b648b959edda715d31796c8f010becd937fd540b2da3835881dbfb

# Database
DATABASE_URL=postgresql://nodesocial:nodesocialpwd@localhost:5433/nodesocial_dev?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3000

# Resend Email (get API key from https://resend.com)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000
```

## Generate a New JWT Secret

If you need to generate a new JWT_SECRET:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Setting Up Resend

1. Sign up at https://resend.com
2. Get your API key from the dashboard
3. Add it to `.env` as `RESEND_API_KEY`
4. Set `RESEND_FROM_EMAIL` to your verified domain email (or use `onboarding@resend.dev` for testing)

## Database Migration

After updating the schema, run:

```bash
cd backend/api
npx prisma migrate dev --name add_password_reset
npx prisma generate
```

## Rate Limiting

Current rate limits:
- **Login**: 5 attempts per minute
- **Register**: 3 attempts per minute
- **Forgot Password**: 3 attempts per 15 minutes
- **Reset Password**: 5 attempts per hour
- **Global**: 100 requests per minute

