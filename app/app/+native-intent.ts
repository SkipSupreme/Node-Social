// Rewrite deep link paths that are handled as modals (not routes)
// so Expo Router navigates to "/" instead of showing +not-found.
// The Linking.addEventListener in _layout.tsx still catches the token
// and shows the appropriate auth modal.
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    // Parse the path to check the pathname component
    // path may be a full URL like "nodesocial://reset-password?token=abc"
    // or a relative path like "/reset-password?token=abc"
    const url = new URL(path, 'nodesocial://app');
    const pathname = url.pathname;

    if (pathname === '/reset-password' || pathname === '/verify-email') {
      return '/';
    }

    return path;
  } catch {
    // If URL parsing fails, check raw string
    if (path.includes('reset-password') || path.includes('verify-email')) {
      return '/';
    }
    return path;
  }
}
