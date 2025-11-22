# Google Sign-In Investigation Report

## Problem Description
The "Continue with Google" sign-in flow in the application is redirecting users to the Google homepage instead of the app's feed after successful authentication. This prevents users from logging in via Google.

## Investigation Summary

The codebase implements the Google Sign-In flow using standard practices for both the frontend (Expo/React Native) and the backend (Node.js API). However, the observed behavior (redirection to Google homepage) strongly indicates a misconfiguration *outside* the application's code, specifically within the Google Cloud Console project settings for OAuth 2.0 Client IDs.

### Frontend (app/src/screens/LoginScreen.tsx)
- The `LoginScreen.tsx` is responsible for initiating the Google OAuth flow.
- It uses `expo-auth-session/providers/google`'s `useIdTokenAuthRequest` hook to start the authentication process.
- The Google Client IDs (Web, iOS, Android) are correctly loaded from `app/src/config.ts`.
- Upon successful authentication with Google, `expo-auth-session` is expected to provide an `id_token`.
- This `id_token` is then sent to the backend's `/auth/google` endpoint for verification and user session creation.

### Backend (backend/api/src/routes/auth.ts)
- The backend exposes an `/auth/google` endpoint.
- This endpoint receives the `id_token` from the frontend.
- It uses the `google-auth-library` to verify the `id_token` against the configured Google OAuth client IDs (audience check).
- If the token is valid, the backend either finds an existing user or creates a new one in the database.
- Finally, it generates a JSON Web Token (JWT) for the user's session and sends it back to the frontend, effectively logging the user in.

### Configuration (app/src/config.ts, app/app.json, README.md)
- `app/src/config.ts` loads environment variables (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, etc.) and values from `app.json` for Google OAuth client IDs.
- `app/app.json` defines the `scheme` (`nodesocial`) which is crucial for deep linking and redirect URIs in native environments. It also holds the `googleAndroidClientId` under `extra.eas`.
- The `README.md` confirms the use of environment variables for configuring Google OAuth client IDs.

### Root Cause of Incorrect Redirection

The user being redirected to the Google homepage instead of the application after authentication is a classic symptom of an **incorrectly configured Authorized redirect URI** in the Google Cloud Console for the associated OAuth 2.0 Client ID. The OAuth flow is failing at the stage where Google attempts to redirect back to the client application. The frontend never receives the `id_token` because Google doesn't know where to send it.

**Specifically, the following must be correctly configured in the Google Cloud Console:**

1.  **For Web Client ID (used in Expo Go development and web builds):**
    *   The `Authorized redirect URIs` must include the URI that Expo Go uses. This typically follows the format:
        `https://auth.expo.io/@<your-expo-username>/<your-app-slug>`
    *   You can find your exact redirect URI by running `expo start` and checking the logs or by inspecting the `AuthSession.makeRedirectUri()` output within your app during development.
    *   If testing on a web browser directly, `http://localhost:19006` or similar may also be needed.

2.  **For Android Client ID (used in native Android builds):**
    *   The **Package name** must match the `android.package` value in `app.json` (which is `com.nodesocial.app`).
    *   The **SHA-1 signing certificate fingerprint** must be correctly added. This is crucial for Google to verify the authenticity of your Android application.

3.  **For iOS Client ID (used in native iOS builds):**
    *   The **Bundle ID** must match the `ios.bundleIdentifier` value in `app.json`.
    *   The **URL scheme** must match the `scheme` value in `app.json` (`nodesocial`).

### Conclusion and Next Steps

The application's code for Google Sign-In appears robust. The issue is almost certainly an external configuration problem within the Google Cloud Console.

**Before any code changes, the following steps should be taken:**

1.  **Verify Google Cloud Console Settings:**
    *   Navigate to your Google Cloud project.
    *   Go to "APIs & Services" -> "Credentials".
    *   Select the OAuth 2.0 Client ID(s) associated with your application (Web, Android, iOS).
    *   **Carefully check and update the "Authorized redirect URIs" for the Web client** to include the correct Expo Go redirect URI.
    *   **For Android:** Ensure the package name and SHA-1 fingerprint are correct.
    *   **For iOS:** Ensure the Bundle ID and URL Scheme are correct.
2.  **Ensure Environment Variables are Correct:** Double-check that the `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and their backend counterparts (`GOOGLE_OAUTH_..._CLIENT_ID`) are correctly set in your development environment and match the client IDs from the Google Cloud Console.

Once these external configurations are verified and corrected, the Google Sign-In flow should function as expected, redirecting the user to the app's feed after authentication.