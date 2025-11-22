# Troubleshooting "Ineligible accounts" Error for Test Users

If you're getting "Ineligible accounts not added" when trying to add test users, here are solutions:

## Solution 1: Check if Account is Already Added

1. Go to **OAuth consent screen** > **Test users** tab
2. Scroll down to see the list of existing test users
3. Your email might already be there - check the list!

## Solution 2: Verify Your Google Account

The account must be:
- A fully set up Google account (not just created)
- Not a brand new account (sometimes new accounts aren't eligible)
- A personal Gmail or Google Workspace account

Try:
1. Make sure you can sign in to Google with that email
2. Go to [myaccount.google.com](https://myaccount.google.com) and verify the account is active
3. Make sure 2FA is set up (sometimes required)

## Solution 3: Use a Different Google Account

If the account still won't work:
1. Use a different Google account (Gmail) for testing
2. Add that account as a test user
3. Sign in with that account in your app

## Solution 4: Check Account Type

Some account types aren't eligible:
- ❌ Google accounts that are too new (< 24 hours old sometimes)
- ❌ Accounts with restrictions
- ✅ Regular Gmail accounts work best
- ✅ Google Workspace accounts work

## Solution 5: Publish Your App (Skip Test Users)

If you can't add test users, you can publish your app instead:

1. Go to **OAuth consent screen**
2. Click **PUBLISH APP** button
3. This makes it available to all users (not just test users)
4. **Note**: For production, you'll eventually need to verify your app with Google, but for testing with friends, this works

**Warning**: Publishing makes your app available to anyone, but if it's just for you and friends, this is fine for now.

## Solution 6: Check if You're the Owner

Make sure you're:
- Logged into Google Cloud Console with the correct account
- The owner/admin of the Google Cloud project
- Not using a restricted account

## Quick Fix: Try This First

1. **Check if already added**: Scroll down in Test users list
2. **Try a different Google account**: Use another Gmail if you have one
3. **Or publish the app**: Click PUBLISH APP to skip test users requirement

## Most Likely Issue

The email might already be in the test users list - scroll down and check! If it's there, you're good to go.

If it's not there and won't add, try using a different Google account or publish the app.

