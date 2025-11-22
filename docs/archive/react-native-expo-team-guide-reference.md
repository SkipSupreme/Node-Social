# React Native with Expo SDK 54: Complete development guide for Node Social

This comprehensive guide takes the Node Social development team from zero knowledge to full productivity with Expo SDK 54, covering everything needed to build a modern, performant social media platform. Expo SDK 54, released September 10, 2025, brings React Native 0.81 and React 19.1 with groundbreaking performance improvements including 10x faster iOS builds through precompiled XCFrameworks, iOS 26 Liquid Glass UI support, and mandatory Android 16 edge-to-edge design. This marks the final SDK supporting Legacy Architecture—SDK 55 will require the New Architecture. The guide provides practical, battle-tested patterns specifically for social media applications with real-world code examples, configuration snippets, and troubleshooting strategies relevant to Node Social's needs.

## Getting started and development environment setup

Setting up a proper development environment is the foundation for productive Expo development. The process varies by platform but follows consistent patterns that get the team building quickly.

**System requirements across platforms**

macOS is required for iOS development and provides the most comprehensive development experience. Teams need Xcode 16.1 minimum (Xcode 26 recommended for iOS 26 features), Node.js 20.19.4 or higher, CocoaPods installed via Ruby, and the iOS Simulator included with Xcode. Physical iOS devices require an Apple Developer account for testing.

Windows and Linux systems support Android development exclusively. Both need Node.js 20.19.4+, Android Studio with the latest version, Android SDK Platform 36 (API Level 36), and either an Android Emulator or physical device. Windows developers benefit from WSL2 for improved development experience, though it's not strictly required.

**Installing Node.js and package managers**

The first step involves verifying or installing the correct Node.js version. Check the current version with `node -v` and ensure it meets the 20.19.4 minimum. Using nvm (Node Version Manager) simplifies version management across projects. On macOS and Linux, install nvm with curl, then run `nvm install 20` followed by `nvm use 20`. Windows developers can download directly from nodejs.org or use nvm-windows.

Expo SDK 54 supports multiple package managers including npm (default), Yarn Classic (v1), Yarn Modern (v2+ with nodeLinker: node-modules), pnpm with isolated installations, and Bun. The critical rule: always use `npx expo install <package-name>` instead of package manager commands directly for Expo packages. This ensures version compatibility across the SDK.

**Creating a new Expo project**

Creating a new project is straightforward. Run `npx create-expo-app@latest node-social` for the default template with Expo Router, or specify templates like `--template blank` for minimal setup, `--template blank-typescript` for TypeScript, or `--template tabs` for tab navigation scaffolding. Navigate into the project directory and start the development server with `npx expo start`.

**Installing essential CLI tools**

Expo CLI comes bundled with the expo package, installed automatically with new projects. For cloud builds and deployments, install EAS CLI globally with `npm install -g eas-cli`, then authenticate using `eas login` or `npx expo login`. Verify installations with `npx expo --version` and `eas --version`.

**Platform-specific setup for iOS development**

iOS development on macOS requires several steps. First, install Xcode 16.1 or higher from the Mac App Store (Xcode 26 recommended for full SDK 54 feature support). Install Xcode Command Line Tools by running `xcode-select --install` in the terminal. Install CocoaPods with `sudo gem install cocoapods`. Launch Xcode, open preferences, and install desired iOS Simulators under the Platforms section.

**Platform-specific setup for Android development**

Android setup works across all platforms. Download and install Android Studio, ensuring these components are selected during installation: Android SDK, Android SDK Platform, and Android Virtual Device (AVD). Open Android Studio's SDK Manager, select the SDK Platforms tab, and check Android 16 (API 36). Switch to the SDK Tools tab and verify Android SDK Build-Tools 36 is installed.

Configure environment variables by adding these lines to shell configuration files like .bashrc or .zshrc. On macOS use `export ANDROID_HOME=$HOME/Library/Android/sdk`, on Linux use `export ANDROID_HOME=$HOME/Android/Sdk`, and on Windows use `export ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`. Also add `export PATH=$PATH:$ANDROID_HOME/emulator` and `export PATH=$PATH:$ANDROID_HOME/platform-tools`. Restart the terminal or source the configuration file.

**Understanding the project structure**

New Expo projects follow a conventional structure. The `app/` directory contains Expo Router file-based routing with `_layout.tsx` defining the root layout, `index.tsx` as the home screen, and `+not-found.tsx` handling 404 pages. The `assets/` folder stores static resources like fonts and images. The `components/` directory houses reusable React components, while `constants/` contains app-wide constants. The `node_modules/`, `.expo/`, `android/`, and `ios/` directories are gitignored as they're generated or installed.

Key configuration files include `package.json` defining dependencies and scripts with `"main": "expo-router/entry"` as the entry point for Expo Router. The `app.json` file contains Expo configuration for builds and behavior. The `babel.config.js` configures Babel transpilation, while `metro.config.js` (optional) customizes the Metro bundler. TypeScript projects include `tsconfig.json` for compiler options.

**Development workflow essentials**

Start the development server with `npx expo start`. This launches the Metro bundler and displays a terminal UI with a QR code for device connection and keyboard shortcuts. Press `i` to open the iOS simulator, `a` for Android emulator, `w` for web browser, `r` to reload the app, and `j` to open the debugger. Press `?` to see all available shortcuts.

The Expo CLI provides several essential commands. Use `npx expo install <package>` to install compatible packages, `npx expo-doctor` to check project health, `npx expo prebuild --clean` to generate native projects when needed, and `npx expo run:ios` or `npx expo run:android` for platform-specific execution. Run `npx expo install expo@^54.0.0 --fix` to upgrade SDK versions.

Fast Refresh activates automatically on file save, preserving component state for rapid iteration. Press `r` in the terminal for manual reload. Configure VS Code integration with the Expo Tools extension for enhanced debugging and development experience.

## Core concepts and architecture understanding

Expo SDK 54's architecture consists of layered components working together seamlessly. At the foundation sits the expo package containing expo-modules-core (native module system), expo-modules-autolinking (automatic dependency linking), @expo/cli (command-line interface), and essential modules like expo-asset, expo-font, and expo-keep-awake. Above this, approximately 100+ optional SDK packages provide device features installed individually with `npx expo install`. The framework layer includes React Native 0.81.3 for UI components and React 19.1.0 for the JavaScript library foundation.

**Expo Go versus Development Builds versus Production Builds**

Understanding the three build types is critical for efficient development. Expo Go is a pre-built sandbox app with common native modules, excellent for quick prototyping, learning React Native, instant testing on physical devices, and demos. However, it's limited to pre-installed native modules, cannot include custom native code, doesn't fully support custom splash screens and icons, lacks remote push notification support and Universal Links, supports only the latest SDK version, and is not recommended for production applications. Use Expo Go for initial learning, rapid prototyping, demonstrations, and testing basic Expo features.

Development Builds represent the team's own customized version of Expo Go with complete native control. These builds support any native library, allow full native code customization, enable testing of custom splash screens and icons, support push notifications and deep linking, include expo-dev-client with an enhanced development menu, and provide SDK version flexibility. The tradeoff involves requiring native app compilation with initial setup time and rebuilding when native dependencies change. Development Builds are essential for production app development, apps requiring custom native modules, apps with specific native configurations, and thorough testing of production features.

Creating Development Builds involves installing expo-dev-client with `npx expo install expo-dev-client`, then building with EAS cloud services using `eas build --profile development --platform ios` or `eas build --profile development --platform android`. Alternatively, build locally with `npx expo run:ios` on macOS or `npx expo run:android` on all platforms.

Production Builds are optimized, release builds for app stores. These include code minification and optimization, remove development tools, sign for distribution, minimize bundle size, and use production environment variables. Create production builds with `eas build --profile production --platform ios` or `eas build --profile production --platform android`. Configure builds in eas.json with appropriate profiles for each environment.

**File-based routing with Expo Router v6**

Expo Router v6 revolutionizes navigation with file-based routing in the `app/` directory. The structure directly maps to routes: `app/_layout.tsx` defines the root layout, `app/index.tsx` serves as `/` (home), `app/about.tsx` maps to `/about`, nested folders like `app/profile/_layout.tsx` and `app/profile/index.tsx` create `/profile` layouts and pages, and dynamic routes like `app/users/[id].tsx` generate `/users/:id` patterns.

Navigation happens through the Link component for declarative routing or programmatic navigation using the router API. Import Link from expo-router and use JSX like `<Link href="/about">About</Link>` or `<Link href="/users/123">View User</Link>`. For programmatic navigation, import router from expo-router and call methods like `router.push('/about')`, `router.replace('/login')`, `router.back()`, or `router.dismissTo('/feed')` introduced in v6.

Expo Router v6 introduces powerful new features for modern mobile development. Native Tabs (beta) provide platform-native tab bars for iOS and Android with automatic scrolling and iOS 26 Liquid Glass effects. Link Previews enable iOS-style peek and pop interactions where pressing a link shows a preview of the destination. Context Menus offer richer interactions out of the box. Web Modals now emulate iPad/iPhone modal behavior for consistency. Server Middleware (experimental) allows running code before requests reach routes.

**Dynamic configuration with app.json and app.config.js**

Static configuration lives in app.json for straightforward settings. The essential expo configuration includes name (display name), slug (URL-safe identifier), version (semantic version), orientation (portrait/landscape), icon (app icon path), and platform-specific settings. iOS configuration includes bundleIdentifier (reverse domain), buildNumber (build version), supportsTablet boolean, and icon supporting the new .icon format for iOS 26 Liquid Glass effects with automatic fallback. Android configuration needs package name, versionCode (integer build), adaptiveIcon with foreground and background images, and navigationBar with enforceContrast for SDK 54. The plugins array includes strings or arrays for configuration, scheme defines URL schemes for deep linking, and updates configuration includes url for EAS Update and runtimeVersion policy.

Dynamic configuration through app.config.js enables environment-based settings using process.env variables. Export a function accepting config that returns modified configuration. Access environment variables, customize app names per environment, set dynamic bundle identifiers, and adjust API URLs based on deployment context. This pattern supports multiple environments (development, staging, production) with environment-specific naming, different backend endpoints, and varied feature flags.

SDK 54 introduces important configuration changes. The statusBar field (root and android) is removed—use the expo-status-bar package programmatically instead. The notification field is deprecated in favor of the expo-notifications plugin. New options include ios.icon supporting .icon files for Liquid Glass, android.navigationBar.enforceContrast controlling navigation bar contrast, and android.predictiveBackGestureEnabled as an opt-in for predictive back gestures that will become default in SDK 55 or 56.

**Understanding Expo Go limitations and when to transition**

Expo Go serves as an excellent learning tool and prototyping environment, but Node Social will need Development Builds once the team starts implementing core features. The transition should happen when integrating authentication providers requiring native SDKs, implementing push notifications with custom configurations, adding media features beyond basic image picking, integrating analytics or crash reporting services, or customizing native UI elements. Development Builds eliminate these restrictions while maintaining the excellent developer experience Expo provides.

## Essential features for social media platforms

Building Node Social requires mastering several critical feature categories that define modern social media experiences. These features leverage Expo SDK 54's robust APIs and modern React Native capabilities.

**Navigation and routing architecture**

Expo Router v6 provides the recommended navigation solution with file-based routing that automatically generates routes from the app directory structure. Install dependencies with `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar`. Configure app.json to include the expo-router plugin and set the scheme for deep linking. Update package.json to set `"main": "expo-router/entry"`.

For social media apps, organize routes with tabs as the primary navigation pattern. Create `app/(tabs)/_layout.tsx` using the Tabs component from expo-router to define tab screens for home feed, search, create post, notifications, and profile. Use Stack navigation for hierarchical navigation like post details, user profiles, and settings. Implement modals with `presentation: 'modal'` for quick actions like composing posts, sharing content, or editing profiles.

Native Tabs in SDK 54 (beta) provide platform-native implementations with excellent performance. Import Tabs from `expo-router/unstable-native-tabs` and define screens with appropriate icons and labels. These tabs support iOS 26 Liquid Glass effects, automatic scrolling to top on tab press, and native animations.

Deep linking enables sharing content directly to specific screens. Configure URL schemes in app.json under the scheme field and set up intent filters for Android. Access deep link parameters in screens using useLocalSearchParams from expo-router. Implement Universal Links (iOS) and App Links (Android) for seamless web-to-app transitions.

**User authentication flows**

Authentication forms the security foundation for Node Social. Implement OAuth flows using expo-auth-session and expo-crypto. Install with `npx expo install expo-auth-session expo-crypto expo-web-browser`. Call WebBrowser.maybeCompleteAuthSession() to handle completion properly.

For Google OAuth, create an AuthSession.useAuthRequest with appropriate client ID, scopes (profile, email), and redirect URI using AuthSession.makeRedirectUri. Handle the response in useEffect by checking response.type === 'success' and exchanging the authorization code for access tokens. The discovery object specifies authorizationEndpoint and tokenEndpoint URLs.

Apple Sign In (iOS-only) uses expo-apple-authentication. Install with `npx expo install expo-apple-authentication`. Use the AppleAuthenticationButton component with appropriate button type and style. Call AppleAuthentication.signInAsync requesting full name and email scopes. Handle the credential response containing user identifier and identity token.

Token storage must use expo-secure-store, never AsyncStorage. Install with `npx expo install expo-secure-store`. Use SecureStore.setItemAsync to save tokens, SecureStore.getItemAsync to retrieve them, and SecureStore.deleteItemAsync to remove tokens on logout. This leverages iOS Keychain and Android Keystore for encrypted storage.

Implement an authentication context pattern to manage auth state throughout the app. Create AuthContext with createContext and useContext hooks. The provider manages user state, loading state, and sign in/out functions. Load saved tokens on app start and verify validity with the backend. Wrap the root layout with AuthProvider to make authentication available everywhere.

**Image, video, and media handling**

Media handling is central to social platforms. Expo SDK 54 provides powerful, optimized APIs for all media operations. Use expo-camera for capturing photos and videos in-app. Install with `npx expo install expo-camera` and add the config plugin to app.json with camera and microphone permission descriptions. The CameraView component from expo-camera provides facing selection (front/back), quality settings, and photo/video capture methods. Request permissions with useCameraPermissions hook before rendering the camera.

For selecting media from the device library, expo-image-picker provides comprehensive functionality. Install with `npx expo install expo-image-picker`. Use ImagePicker.launchImageLibraryAsync with options for media types (images, videos), editing capabilities, aspect ratio, quality settings, and multiple selection with selectionLimit. The result contains an assets array with URIs and metadata for selected media.

Video playback in SDK 54 uses expo-video, replacing the deprecated expo-av. Install with `npx expo install expo-video`. Use the useVideoPlayer hook with a source URI to create a player instance, then render with VideoView component. Configure player properties like looping, autoplay, fullscreen support, and picture-in-picture mode.

Image optimization is critical for feed performance. Use expo-image exclusively instead of React Native's Image component. Install with `npx expo install expo-image`. The Image component from expo-image includes automatic caching with cachePolicy options (memory-disk, disk, memory, none), content fit modes (cover, contain, fill), transition animations, blurhash placeholder support, and priority hints for loading optimization.

Uploading media requires proper handling of FormData. Create a FormData instance and append files with appropriate MIME types. For images use image/jpeg or image/png, for videos use video/mp4. The URI from expo-image-picker works directly with fetch for multipart/form-data uploads. Handle upload progress by implementing progress tracking in the upload function.

**Real-time features and WebSocket implementation**

Social media platforms require real-time updates for messages, notifications, and feed updates. React Native supports native WebSocket APIs for straightforward implementation. Create a custom useWebSocket hook that initializes a WebSocket connection in useEffect, handles onopen, onmessage, onerror, and onclose events, maintains connection state, and provides a sendMessage function. Clean up by closing the connection on unmount.

For more robust real-time features, Socket.IO provides automatic reconnection, room support, and event-based messaging. Install with `npm install socket.io-client`. Create a useSocketIO hook that initializes the socket with io(), configures authentication tokens, enables reconnection with appropriate attempts and delays, and returns the socket instance for event listening and emission.

Implement real-time chat rooms by combining WebSocket connections with message state management. Track connection status to disable input when offline, send messages with user ID, room ID, and timestamp, store incoming messages in state, and render with FlatList or FlashList for performance.

**Push notifications configuration and handling**

Push notifications drive engagement in social platforms. Configure expo-notifications for both local and remote notifications. Install with `npx expo install expo-notifications expo-device expo-constants`. Set notification handlers globally with Notifications.setNotificationHandler specifying whether notifications should play sound, set badges, show banners, and appear in lists when the app is foregrounded.

Register for push notifications by checking Device.isDevice (notifications require physical devices), requesting permissions with Notifications.requestPermissionsAsync, retrieving the Expo Push Token with Notifications.getExpoPushTokenAsync passing the project ID from expo config, and sending the token to your backend for storage and targeting.

Handle incoming notifications with notification listeners. Use Notifications.addNotificationReceivedListener for foreground notifications and Notifications.addNotificationResponseReceivedListener for user taps. Access notification data from the content to navigate to specific screens or update app state. Always remove subscriptions in cleanup functions.

Send notifications from the server using the Expo Push API. POST to https://exp.host/--/api/v2/push/send with payload including the Expo push token, sound, title, body, data object for custom navigation, and badge count. Schedule local notifications with Notifications.scheduleNotificationAsync for reminders or offline queued actions.

**Gesture handling and animations**

Modern interactions require sophisticated gesture recognition and smooth animations. React Native Gesture Handler provides platform-native gesture recognition. Install with `npx expo install react-native-gesture-handler` and wrap the root layout in GestureHandlerRootView with flex: 1 styling.

Create gestures using the Gesture API. Pan gestures enable swipe actions for dismissing posts or navigating between screens. Tap gestures, especially double-tap, implement like buttons by detecting numberOfTaps: 2. Long press gestures show context menus for post actions. Pinch gestures enable image zoom, and rotation gestures allow creative photo editing.

React Native Reanimated v4 provides powerful animation capabilities. In SDK 54, Reanimated v4 requires the New Architecture and react-native-worklets peer dependency. Install with `npx expo install react-native-reanimated react-native-worklets`. The babel-preset-expo automatically configures the required Babel plugin.

Use shared values with useSharedValue to track animated properties, animated styles with useAnimatedStyle to derive styles from shared values, and animation functions like withSpring for physics-based animations and withTiming for duration-based transitions. The entering and exiting animations provide pre-built transitions like FadeIn, SlideInRight, and custom sequences.

Combine gestures and animations for interactive experiences. Double-tap to like posts with scale animation feedback, swipe cards left or right with pan gestures and translateX, scroll-driven parallax effects using scroll position, and interactive buttons with pressIn/pressOut scale animations.

**Optimized list rendering for feeds**

Feed performance makes or breaks social media apps. Replace all FlatList usage with FlashList from Shopify for dramatic performance improvements. Install with `npx expo install @shopify/flash-list`. FlashList provides 54% FPS improvement over FlatList, reduces JS thread utilization from over 90% to under 10%, decreases CPU usage by 82%, and maintains smooth scrolling even with complex items.

The critical requirement for FlashList is providing estimatedItemSize—an approximate height for list items in pixels. This enables FlashList's recycling algorithm. For mixed content types, implement getItemType returning identifiers like 'text', 'image', or 'video' to enable type-specific recycling pools.

Optimize list items by memoizing components with React.memo, implementing custom comparison functions to prevent unnecessary re-renders, using selective subscriptions from state management (only subscribe to needed data), and avoiding inline function definitions in renderItem props.

Implement infinite scroll by tracking page state, loading indicators, and hasMore flags. Use onEndReached callback with appropriate onEndReachedThreshold (typically 0.5) to load more data when users approach the bottom. Integrate with React Query's useInfiniteQuery for automatic pagination, caching, and refetching.

Pull-to-refresh provides manual update triggers. Set refreshing prop to loading state and onRefresh to a function that resets page state and reloads data. React Query handles this elegantly with the refetch function from query hooks.

## State management and data fetching patterns

Effective state management separates good apps from great ones. Modern React Native apps benefit from combining specialized tools for different state types rather than forcing everything through a single solution.

**Client state management with Zustand**

Zustand provides the optimal balance of simplicity and power for Node Social's client state needs. Install with `npx expo install zustand`. Create stores using the create function, defining state and actions as properties. Zustand's key advantage is selective subscriptions—components only re-render when their specific subscribed values change, not on any state update.

For social media apps, create separate stores for different domains. A posts store manages the feed with posts array, loading state, and actions like setPosts, addPost, likePost, and clearPosts. A user store tracks profile information, preferences, and settings. A notifications store handles unread counts, notification lists, and mark-as-read actions.

Persist state across app restarts using Zustand's persist middleware with AsyncStorage. Install the storage with `npx expo install @react-native-async-storage/async-storage`. Wrap the create function in persist middleware, specifying a storage name and the createJSONStorage adapter with AsyncStorage. Zustand automatically serializes and deserializes state on app launches.

Use selective subscriptions in components by passing selector functions to store hooks. Instead of subscribing to the entire store with `const state = usePostsStore()`, select specific values with `const posts = usePostsStore(state => state.posts)`. This prevents components from re-rendering when unrelated state changes.

**Server state management with TanStack Query**

TanStack Query (React Query) revolutionizes server state management with automatic caching, background refetching, optimistic updates, and request deduplication. Install with `npx expo install @tanstack/react-query`. Create a QueryClient with appropriate default options including staleTime (how long data stays fresh), retry attempts, and refetch behaviors.

Configure online detection for React Native by setting up the onlineManager with expo-network. Add a network state listener that updates the online status when connectivity changes. Configure focus management with AppState to refetch queries when the app returns to foreground. Wrap the app in QueryClientProvider to enable queries throughout the component tree.

Implement infinite scroll feeds with useInfiniteQuery. Define the queryKey, queryFn accepting a pageParam, getNextPageParam returning the next page number or undefined when complete, and initialPageParam for the starting page. Access data.pages to flatten all loaded pages, call fetchNextPage to load more, and check hasNextPage to conditionally show loading indicators.

Optimistic updates provide instant feedback for user actions like liking posts. In the mutation, implement onMutate to cancel ongoing queries, snapshot current data for rollback, and immediately update the cache with optimistic changes. If the mutation fails, onError receives the snapshot context and restores previous data. On success, invalidate affected queries to refetch fresh data from the server.

Configure caching strategies per query based on data characteristics. Static data like categories uses staleTime: Infinity and long cacheTime. Real-time data uses staleTime: 0 with refetchInterval for polling. User-generated content balances with medium stale times and refetch on window focus.

**Offline support and local storage**

Social media apps must function gracefully offline. Persist React Query cache to AsyncStorage using the createAsyncStoragePersister and persistQueryClient utilities. Install with `npm install @tanstack/query-async-storage-persister`. Configure maxAge for how long persisted data remains valid.

Expo SQLite provides robust local database capabilities. Install with `npx expo install expo-sqlite`. Open a database with SQLite.openDatabaseSync, create tables with execSync, save data with runSync for insert/update operations, and query data with getAllSync or getFirstSync. The new API in SDK 54 uses synchronous operations for improved performance.

Implement offline-first patterns by attempting network requests first, falling back to local database on failure, queueing mutations for retry when online, and syncing local changes when connectivity returns. Track network state with expo-network's NetworkStateType to show offline indicators and disable network-dependent features.

For complex offline sync requirements, consider WatermelonDB or Realm. WatermelonDB provides lazy loading, observables for reactive updates, and multi-platform support. Realm offers automatic sync with MongoDB Realm, offline-first architecture, and real-time updates. Both require additional setup but excel at complex relational data with sophisticated synchronization needs.

**Performance optimization strategies**

State management performance impacts the entire app. Follow these patterns to maintain responsiveness. Memoize expensive computations with useMemo to avoid recalculating on every render. Memoize callback functions with useCallback when passing to child components to prevent re-renders. Use React.memo for components with expensive rendering when props haven't changed.

Avoid common performance pitfalls. Never use inline object or array literals as props—they create new references every render. Don't subscribe to entire state objects when only needing specific properties. Avoid putting derived state in global stores—compute it in selectors. Don't store server data in Zustand—use React Query instead.

Monitor performance with React DevTools Profiler to identify slow components, Flipper's performance plugin to track FPS and thread utilization, and Hermes profiler for JavaScript execution analysis. Set performance budgets: maintain 60 FPS during scrolling, keep JS thread utilization under 10% during idle, limit bundle size to under 5MB for production, and target under 3 seconds for time to interactive.

## Performance optimization for production apps

Node Social must deliver smooth, responsive experiences even with thousands of users generating content. SDK 54's performance improvements provide an excellent foundation, but proper optimization techniques ensure production success.

**List performance with FlashList**

FlashList represents a quantum leap in list performance. The architectural difference lies in recycling—FlashList recycles views more efficiently than FlatList, reducing the number of views in memory. Migration requires minimal changes but provides dramatic benefits. Replace FlatList imports with FlashList from @shopify/flash-list, add the required estimatedItemSize prop representing average item height, and optionally implement getItemType for heterogeneous lists.

Advanced FlashList configuration includes drawDistance to control render buffer size (defaults to 250, increase for complex items), overrideItemLayout for precise measurements avoiding relayout, and blank space optimization by tuning estimatedItemSize closer to actual measurements. For horizontal lists, estimatedItemSize represents width instead of height.

Performance benchmarks demonstrate FlashList's superiority. For a feed with 100 complex items, FlatList achieves 36.9 FPS with 198.9% CPU usage, while FlashList maintains 56.9 FPS with only 36.5% CPU usage. JS thread utilization drops from over 90% to under 10%, eliminating the primary bottleneck in list rendering.

**Image optimization techniques**

Images dominate social media app bandwidth and memory. Expo-image's sophisticated caching eliminates repeated downloads. The cachePolicy prop controls behavior: memory-disk (recommended, persistent cache), disk (only disk cache), memory (session cache), and none (always fetch). Images persist between app launches with disk caching.

Optimize image loading with priority hints. Set priority="high" for above-the-fold content like the first three feed items, and priority="normal" for everything else. This ensures critical content appears immediately while batching less important loads.

Implement blurhash placeholders for perceived performance. Generate blurhashes server-side during upload and include in post metadata. Pass as placeholder={{ blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.' }} to expo-image. Users see blurred previews instantly while full images load, dramatically improving perceived loading speed.

Compress images before upload using expo-image-manipulator. Install with `npx expo install expo-image-manipulator`. Resize images to maximum 1024-2048px width—social platforms don't need higher resolution for mobile displays. Set compress between 0.7-0.8 for optimal quality-to-size ratio. Convert to JPEG format for smaller file sizes unless transparency is required.

Prefetch images for smooth transitions. Use Image.prefetch from expo-image with arrays of upcoming image URLs. Prefetch profile pictures when loading user lists, next page images before infinite scroll triggers, and linked content images when hovering links. This eliminates loading delays when users navigate.

**Bundle size optimization**

Smaller bundles mean faster startup and lower data usage. Expo Atlas, new in SDK 54, visualizes bundle composition. Set `EXPO_UNSTABLE_ATLAS=true` then run `npx expo start`. Press Shift + M in the terminal and select "Open expo-atlas" to analyze which packages consume the most space.

Tree-shaking improves when using specific imports. Instead of `import _ from 'lodash'` importing the entire library, use `import debounce from 'lodash/debounce'` for targeted imports. Similarly, `import format from 'date-fns/format'` imports only the format function rather than the entire date-fns library.

Remove console.log statements in production by configuring Metro. In metro.config.js, set minifierConfig with compress: { drop_console: true }. This eliminates all console calls from production bundles, reducing size and improving performance.

Enable ProGuard on Android for additional optimization. In android/app/build.gradle, set minifyEnabled and shrinkResources to true in the release buildType. ProGuard removes unused code and resources, significantly reducing APK size.

**Memory management best practices**

Memory leaks accumulate over time, degrading performance and causing crashes. Always clean up subscriptions and listeners in useEffect return functions. Remove event listeners, cancel timers, close WebSocket connections, and unsubscribe from observables.

Clear image caches during memory warnings. Listen to AppState's memoryWarning event and call Image.clearMemoryCache() from expo-image. This prevents out-of-memory crashes on devices with limited RAM.

Avoid accumulating unlimited state. Implement pagination limits for loaded posts, clear old cached data after time thresholds, remove completed notifications after display, and periodically reset deeply nested state to prevent memory growth.

**Performance monitoring in production**

Continuous monitoring identifies issues before users complain. Flipper provides development-time insights with React DevTools for component profiling, Performance Monitor for FPS tracking, Network Inspector for API monitoring, and Layout Inspector for UI debugging.

Implement production monitoring with Sentry for error tracking and performance insights. Install with `npm install @sentry/react-native`. Configure with DSN and tracesSampleRate (0.1 samples 10% of transactions). Sentry captures errors, slow transactions, and performance metrics automatically.

Set performance budgets and monitor compliance. Target 60 FPS (16.67ms per frame) during scrolling, JS thread utilization under 20%, bundle size under 5MB, time to interactive under 3 seconds, and memory usage under 200MB during normal operation. Alert when metrics exceed budgets.

## Native modules, APIs, and SDK integration

Expo SDK 54 includes over 100 native modules covering most social media platform needs. Understanding when to use SDK modules versus custom native code optimizes development velocity.

**Essential Expo SDK 54 modules for Node Social**

Media modules form the core of social platforms. Use expo-image for all image rendering with performant caching and transitions. Implement expo-camera for capturing photos and videos with flash, zoom, and camera switching. Use expo-image-picker for selecting media from device libraries with multi-select support. Implement expo-video (replaces deprecated expo-av) for video playback with fullscreen and picture-in-picture. Use expo-audio (replaces expo-av audio) for voice messages and audio posts.

Social features modules enable platform interactions. Implement expo-notifications for local and remote push notifications with scheduling and badges. Use expo-sharing for native share dialogs integrating with platform share sheets. Implement expo-contacts for friend discovery through contact sync. Use expo-location for geolocation features, check-ins, and location tagging.

Storage modules manage data persistence. Use expo-file-system with the new SDK 54 API for file management, media caching, and offline content. Implement expo-sqlite for local relational databases with the new synchronous API. Use expo-secure-store for encrypted storage of authentication tokens and sensitive data.

SDK 54 introduces new modules. Expo-app-integrity verifies app authenticity using DeviceCheck (iOS) and Play Integrity API (Android), preventing tampering and abuse. Expo-blob (beta) implements W3C Blob API for binary data handling. Expo-glass-effect (iOS 26) creates modern Liquid Glass UI effects with GlassView and GlassContainer components. Expo-background-task replaces expo-background-fetch with modern WorkManager (Android) and BGTaskScheduler (iOS) APIs.

**Config plugins for native configuration**

Config plugins modify native projects during prebuild, enabling Continuous Native Generation without manually editing Xcode or Android Studio. Use built-in plugins by adding to the plugins array in app.json. Simple plugins use string identifiers, while configurable plugins use arrays with options objects.

Common config plugin patterns include permission configuration, where expo-camera accepts cameraPermission and microphonePermission text, expo-location requires locationAlwaysAndWhenInUsePermission descriptions, and expo-notifications configures icon and sound resources. App icon and splash screen configuration uses expo-splash-screen plugin with image, dimensions, and resize mode options. Service integration uses plugins like @react-native-firebase/app accepting iOS GoogleService-Info.plist and Android google-services.json paths.

Create custom config plugins for unique native requirements. Install @expo/config-plugins as a dev dependency. Export a function accepting config and props that returns modified config. Use withAndroidManifest to modify AndroidManifest.xml and withInfoPlist to modify Info.plist. Place plugins in a plugins directory and reference with relative paths in app.json.

SDK 54 introduces important changes. Android edge-to-edge is mandatory and cannot be disabled (use navigationBar.enforceContrast to control contrast). Predictive back gesture is opt-in via android.predictiveBackGestureEnabled but will become default in SDK 55 or 56. iOS 26 supports .icon files for Liquid Glass through ios.icon configuration with automatic fallback for iOS ≤19.

**When to implement custom native modules**

Custom native modules become necessary when accessing platform-specific APIs not in Expo SDK, integrating third-party native SDKs for services like payment processors, implementing performance-critical operations requiring native optimization, accessing specialized hardware like NFC or Bluetooth Low Energy, creating background services for data sync or location tracking, and building custom native UI components with platform-specific styling.

Before writing custom native code, thoroughly check Expo SDK modules and popular community modules. Many common needs have existing solutions. Search React Native Directory (reactnative.directory) for community packages. Check if config plugins enable the required functionality without custom code.

The Expo Modules API provides the modern approach to native module development. Write modules once using Swift and Kotlin that work on iOS, Android, and web. Benefits include auto-generated TypeScript types, better error messages, simpler APIs than traditional React Native modules, and first-class Expo integration. Documentation at docs.expo.dev/modules/overview provides comprehensive guides.

## Building and deploying Node Social

Production deployment requires understanding build types, store submission processes, and over-the-air updates. EAS (Expo Application Services) streamlines these workflows significantly.

**EAS Build configuration and setup**

Install EAS CLI globally with `npm install -g eas-cli` then authenticate with `eas login`. Initialize EAS in the project with `eas init` to create an Expo account link. Run `eas build:configure` to generate the eas.json configuration file.

Configure eas.json with multiple profiles for different build types. The development profile sets developmentClient: true, distribution: internal, enables iOS simulator builds with simulator: true, and uses android.withoutCredentials: true for passwordless builds. The staging profile uses distribution: internal, specific channel for EAS Update, and android.buildType: apk for easy distribution. The production profile targets app stores with appropriate channels and resource classes (large for iOS for faster builds, medium for Android).

Build development builds with `eas build --platform ios --profile development` and `eas build --platform android --profile development`. These builds include expo-dev-client for enhanced debugging and support all native modules. Install on devices or simulators for testing.

Build production releases with `eas build --platform ios --profile production` and `eas build --platform android --profile production`. iOS produces IPA files for App Store or TestFlight. Android produces AAB (Android App Bundle) or APK based on buildType configuration.

**iOS app store submission process**

Configure iOS submission in eas.json under the submit object. Include ascAppId (App Store Connect app ID), ASC API key details (ascApiKeyPath, ascApiKeyId, ascApiKeyIssuerId) for automated submission without manual login.

Submit builds with `eas submit --platform ios --profile production`. For automatic submission after building, use `eas build --platform ios --auto-submit`. EAS handles IPA upload, TestFlight processing, and submission for App Store review.

Alternatively, use Transporter app from Mac App Store for manual submission. Sign in with Apple ID, drag the IPA file into Transporter, and click Deliver. Monitor submission status in App Store Connect.

TestFlight distribution uses EAS workflows for automation. Configure .eas/workflows/testflight.yml to define jobs for building and submitting. The build_ios job runs on push to main, then submit_testflight job chains with needs: [build_ios] and uses the built IPA for TestFlight distribution.

**Android Google Play submission**

Configure Android submission in eas.json with serviceAccountKeyPath pointing to Google Play service account JSON file and track specifying internal, alpha, beta, or production release track.

Submit with `eas submit --platform android --track internal` or desired track. EAS uploads the AAB to Google Play, processes through app bundle pipeline, and makes available on the specified track.

For manual submission, use Google Play Console. Upload AAB or APK files, configure release details including release notes and rollout percentage, select target tracks, and submit for review.

**Over-the-air updates with EAS Update**

EAS Update enables JavaScript and asset updates without app store review. Install with `npx expo install expo-updates` then configure with `eas update:configure`. Set app.json with updates.url (EAS Update URL) and runtimeVersion policy (typically nativeVersion to match native builds).

Publish updates with `eas update --branch production --message "Bug fixes"` targeting specific branches. Create environment-specific updates with `eas update --branch staging --environment staging`. Updates deploy to devices running builds with matching runtime versions and branches.

Implement update strategies with multiple channels and branches. Use development channel for dev builds, staging for internal testing, and production for released apps. This enables testing updates before production release.

Critical constraints: OTA updates can change JavaScript code, React components, styles and images, and non-native configuration. OTA updates cannot change native code, add new native modules, modify SDK versions, or add new permissions. These changes require new app store builds.

Implement in-app update prompts with useUpdates hook from expo-updates. Check for available updates with checkForUpdateAsync, fetch with fetchUpdateAsync, and reload with reloadAsync. Show update prompts to users or implement silent background updates based on application needs.

**Environment configuration and secrets management**

Manage environment variables through three approaches. Use .env files locally for development with EXPO_PUBLIC_ prefix for client-accessible variables. Store sensitive values in EAS Secrets with `eas secret:create --scope project --name API_KEY --value "secret"`. Configure build-specific variables in eas.json profiles under env objects.

Access environment variables in JavaScript with process.env.EXPO_PUBLIC_API_URL for client-side values. Use expo-constants to access config from Constants.expoConfig?.extra for dynamic configuration.

Implement environment-specific app configurations with app.config.js. Export a function reading process.env.APP_VARIANT to determine environment, return different app names, bundle identifiers, and API URLs per environment, and enable feature flags based on deployment context.

Never commit secrets to git. Use .env.example files showing structure without values, reference EAS Secrets for sensitive data, and document required environment variables in team documentation.

**CI/CD pipeline setup**

Integrate EAS with GitHub Actions for automated workflows. Create .github/workflows/build.yml defining jobs to checkout code, setup Node.js, install dependencies, authenticate with Expo using secrets.EXPO_TOKEN, and run eas build commands.

Implement complete CI/CD with separate jobs for testing (lint and test), building (conditional on test success), and submitting (only on main branch). Use environment-specific profiles based on branch names—production for main, staging for develop.

Test in CI pipelines with Jest configuration supporting Expo and React Native. Run npm test -- --coverage to execute tests and generate coverage reports. Upload coverage to Codecov or similar services. Consider E2E testing with Maestro or Detox for critical user flows.

## Testing strategies and quality assurance

Comprehensive testing ensures Node Social remains stable and bug-free as features expand. Different testing layers catch different issue categories.

**Unit testing with Jest and jest-expo**

Jest provides the foundation for unit testing React Native apps. Expo projects include jest-expo preset automatically. Configure jest.config.js with preset: 'jest-expo', transformIgnorePatterns for node_modules exceptions, and collectCoverageFrom patterns.

Write unit tests for utility functions, business logic, custom hooks, and API service layers. Test pure functions by asserting outputs match expectations for various inputs. Mock Expo modules with jest.mock() or built-in __mocks__.

Test React components with React Native Testing Library. Install with `npm install --save-dev @testing-library/react-native`. Render components with render(), query elements with getByText/getByTestId, simulate user interactions with fireEvent or userEvent, and assert component behavior and UI states.

Test async code using waitFor for UI updates after async operations. Use act() for manual state updates. Mock async functions with jest.fn().mockResolvedValue() for successful responses or mockRejectedValue() for errors.

**Component testing best practices**

Isolate components by mocking dependencies, context providers, and navigation. Provide test implementations of contexts with known values. Mock navigation with createMockNavigation() from testing utilities.

Test user interactions rather than implementation details. Avoid testing internal state or private methods. Focus on user-visible behavior—what renders, what happens on clicks, what displays after async operations.

Use test IDs for reliable element queries. Add testID prop to important elements especially when text content varies. Query with getByTestId('submit-button') for locale-independent tests.

Mock Expo modules properly. Many Expo packages include built-in mocks. Reference module documentation for mock setup. Create manual mocks for modules without provided mocks by implementing __mocks__ directories.

**End-to-end testing strategies**

E2E tests verify complete user flows in production-like environments. Three main options exist for React Native. Maestro provides the simplest setup with no code configuration, YAML-based test definitions, and cross-platform support. Detox offers React Native-specific optimizations, gray box testing with visibility into app internals, and excellent performance. Appium provides multi-platform support including web and native, broader language support, and standardized WebDriver protocol.

Recommended approach: start with Maestro for ease, then consider Detox if needing advanced React Native specific features. Write E2E tests for critical user journeys including authentication flows, creating and publishing posts, liking and commenting on content, searching and discovery, and profile updates.

Keep E2E tests maintainable by limiting to critical paths, running in CI on major branches, using page object patterns for reusability, and maintaining test data isolation between runs.

**Debugging tools and techniques**

React Native DevTools (new in SDK 54) replaces Chrome DevTools as the primary debugging interface. Launch with `j` keyboard shortcut in Expo CLI. Features include React Components tree inspection, Network tab for API requests, Console for logs, and Source debugging with breakpoints.

Access the in-app developer menu by shaking device or pressing `m` in Expo terminal. Options include Reload, Debug Remote JS, Toggle Performance Monitor, Show Inspector, and Fast Refresh settings.

Use console.log strategically during development but remove for production. Consider using __DEV__ checks: `if (__DEV__) console.log('Debug info')` to ensure logs don't reach production.

Implement error boundaries to catch React errors gracefully. Create ErrorBoundary components catching componentDidCatch or using react-error-boundary library. Display fallback UI instead of crashing the entire app. Log errors to error tracking services.

**Production debugging and monitoring**

Integrate Sentry for production error tracking. Install @sentry/react-native with Expo config plugin. Configure DSN and environment in app initialization. Sentry automatically captures unhandled errors, tracks releases with source maps, and provides performance monitoring.

Implement logging strategies for troubleshooting. Use structured logging with log levels (error, warn, info, debug). Log critical user actions, API failures, and state changes. Send logs to backend services for analysis. Consider react-native-logs for advanced logging.

Monitor performance metrics including app launch time, time to interactive, screen load times, API request durations, and memory usage. Set up dashboards tracking these metrics over time. Alert on regressions or spikes indicating performance issues.

## Best practices and team conventions

Consistent patterns across Node Social's codebase improve maintainability and team velocity. These conventions ensure code quality as the team scales.

**Project organization and file structure**

Choose between feature-based or type-based organization. Feature-based structures group files by feature (user, posts, messages), with each feature containing components, hooks, services, and types. This scales better for large apps. Type-based structures group by file type (components, screens, hooks, services), working well for small to medium apps with clearer boundaries.

Recommended structure for Node Social: Use app directory for Expo Router file-based routing with route groups (tabs), (auth), (modals). Create src directory containing features (feed, profile, messages, notifications), shared components, hooks, utils, services (api, storage, analytics), types, and constants. Store assets outside src in assets directory with organized subdirectories for images, fonts, and icons. Keep configuration files at root level.

Implement consistent naming conventions. Use PascalCase for components (FeedPost.tsx, UserProfile.tsx), camelCase for files containing utilities (dateFormatter.ts, apiClient.ts), kebab-case for test files (feed-post.test.tsx), and index files for cleaner imports.

**Component architecture patterns**

Container/Presentational pattern separates logic from UI. Container components handle state, data fetching, and business logic using hooks and services. Presentational components receive props and render UI with minimal logic. This separation improves testability and reusability.

Custom hooks pattern extracts reusable logic. Create hooks for common patterns like usePosts for feed data fetching, useAuth for authentication state and actions, useForm for form validation and submission, and useDebounce for search input optimization. Hooks promote code reuse and keep components focused on rendering.

Composition over props drilling prevents passing props through many layers. Use React Context for shared global state like auth, theme, and i18n. Implement compound components pattern for complex components sharing state. Extract provider components wrapping specific feature contexts.

**TypeScript integration and conventions**

Enable strict TypeScript configuration. Set strict: true in tsconfig.json enabling all strict checks. Set noImplicitAny to catch untyped variables. Enable strictNullChecks for safer null handling. Use noUncheckedIndexedAccess to prevent undefined array access issues.

Type all component props with interface definitions. Define props interfaces above components. Mark optional props with ?. Provide default values for optional props. Export prop interfaces for documentation and reusability.

Configure path aliases for cleaner imports. Add baseUrl and paths to tsconfig.json mapping @/components, @/hooks, @/utils to src directories. Use aliases in imports like `import { Button } from '@/components/Button'` instead of relative paths.

Leverage Expo Router typed routes. Enable experiments.typedRoutes in app.json for automatic route type generation. Import route types from expo-router for type-safe navigation. TypeScript enforces valid route paths and parameters.

**Security best practices for social platforms**

Implement secure authentication with OAuth 2.0 with PKCE for authorization code flow security. Use JWT tokens with appropriate expiration (access tokens short-lived, refresh tokens long-lived). Implement automatic token refresh before expiration. Store tokens exclusively in SecureStore, never AsyncStorage or application state.

Validate all user input on both client and server. Sanitize text input to prevent injection attacks. Validate image uploads for type, size, and content. Implement rate limiting on API endpoints to prevent abuse. Use parameterized queries for database operations.

Secure network communication by enforcing HTTPS for all API calls. Implement certificate pinning for critical API endpoints on production builds. Validate SSL certificates. Timeout requests appropriately to prevent hanging.

Handle sensitive data carefully. Encrypt user data at rest using device-provided encryption. Never log sensitive information like passwords or tokens. Clear sensitive data from memory after use. Implement biometric authentication for re-authentication on sensitive operations.

Content security requires image validation before upload, user-generated content sanitization removing dangerous scripts, implementing content moderation workflows, and reporting mechanisms for inappropriate content.

**Accessibility implementation**

Accessible apps reach wider audiences and provide better experiences for all users. Implement proper accessibility labels on all interactive elements using accessibilityLabel prop. Describe button purposes clearly. Provide context for icons without text. Label form inputs descriptively.

Set accessibilityRole accurately. Use button for buttons, text for text content, image for images, link for navigation links, and adjustable for sliders. Proper roles ensure screen readers announce elements correctly.

Implement accessibilityState for dynamic elements. Indicate selected state for tabs, disabled state for unavailable actions, and checked state for checkboxes. This provides crucial context to assistive technology users.

Support dynamic text sizes by using scalable font sizes, testing with large text accessibility settings, avoiding fixed height containers for text, and implementing horizontal scrolling when needed.

Ensure sufficient color contrast ratios. Use 4.5:1 minimum for normal text, 3:1 for large text, and don't rely solely on color to convey information. Test with color blindness simulators.

## Common pitfalls and troubleshooting

Understanding common issues saves significant debugging time. These patterns appear frequently in Expo projects.

**SDK 54 specific issues and solutions**

SDK 54 introduces breaking changes requiring attention. The statusBar configuration field was removed from app.json root and android sections. Solution: use expo-status-bar package programmatically with StatusBar component in app layouts. Set style prop to auto, light, or dark based on theme.

Reanimated v4 and react-native-worklets conflicts cause build failures. Reanimated v4 requires New Architecture and react-native-worklets peer dependency. Solution: if using Legacy Architecture, downgrade to Reanimated v3. Install with `npx expo install react-native-reanimated@3` and remove worklets dependency. If using New Architecture, ensure both packages are installed with compatible versions.

expo-file-system new API causes import errors. The new API is default in SDK 54 with legacy moved to expo-file-system/legacy. Solution: update imports to new API using object-oriented file/directory classes or temporarily use legacy imports while planning migration.

**Platform-specific gotchas**

iOS requires Xcode 16.1 minimum, Xcode 26 recommended. Older Xcode versions fail building SDK 54 projects. Solution: update Xcode through App Store, ensure command line tools match with `sudo xcode-select --switch /Applications/Xcode.app`, and run `pod install` after Xcode updates.

Android 16 requires edge-to-edge by default and cannot be disabled. Content renders behind status and navigation bars. Solution: wrap content in SafeAreaView from react-native-safe-area-context, use useSafeAreaInsets hook for padding, and test on various Android versions for consistency.

iOS simulator issues with arm64 architecture on M-series Macs sometimes cause crashes. Solution: clean build with `npx expo run:ios --clean`, delete derived data from ~/Library/Developer/Xcode/DerivedData, and rebuild simulator from Xcode if problems persist.

**Performance issues and resolution**

FlatList scrolling jank from inefficient rendering. Solution: migrate to FlashList with estimatedItemSize prop, memoize list items with React.memo, implement proper keyExtractor using stable IDs, and avoid inline function definitions in renderItem.

Images loading slowly or causing memory issues. Solution: use expo-image instead of React Native Image, implement cachePolicy: 'memory-disk', add blurhash placeholders for perceived performance, compress large images before upload, and implement lazy loading for off-screen images.

App bundle too large exceeding store limits. Solution: use Expo Atlas to identify large dependencies, implement tree-shaking with specific imports, remove console.log in production via Metro config, enable ProGuard on Android, and lazy load heavy features with React.lazy.

Memory leaks causing crashes over time. Solution: clean up useEffect subscriptions, remove event listeners in cleanup functions, clear image caches on memory warnings, implement pagination limits preventing unlimited state growth, and profile with React DevTools to identify retention issues.

**Build and deployment problems**

Development builds fail after SDK upgrade. SDK upgrades change native dependencies requiring new development builds. Solution: rebuild development builds with `eas build --profile development --platform all`, clear Metro cache with `npx expo start --clear`, and update Expo CLI and EAS CLI to latest versions.

Dependencies version conflicts during installation. React Native and Expo require specific package versions. Solution: always use `npx expo install <package>` instead of npm/yarn directly, run `npx expo-doctor` to diagnose issues, and check package compatibility at docs.expo.dev.

iOS pod install failures after dependency changes. CocoaPods cache issues cause installation failures. Solution: delete Pods directory and Podfile.lock, run `npx pod-install --clean`, verify Xcode command line tools with `xcode-select -p`, and check Ruby version compatibility.

**Complete SDK 54 migration checklist**

Pre-upgrade tasks: backup project with git commit, document current SDK version and dependencies, review SDK 54 changelog for breaking changes, create new branch for migration, test current app thoroughly to identify existing issues, and notify team of migration timeline.

During upgrade: update packages with `npx expo install expo@^54.0.0 --fix`, enable New Architecture with newArchEnabled: true in app.json, migrate expo-av to expo-video and expo-audio, update expo-file-system imports to new API, review and update config plugins, test on iOS 26 and Android 16 devices, update Xcode to 16.1+, verify Android 16 edge-to-edge behavior, clean and rebuild native folders, run `npx expo prebuild --clean`, install pods with `npx pod-install`, rebuild development builds, and run `npx expo-doctor` to verify health.

Post-upgrade testing: test all authentication flows, verify media upload and display, check push notification delivery, test real-time features, profile performance with Flipper, analyze bundle size with Expo Atlas, test on multiple device sizes, verify accessibility, run full test suite, and test builds on physical devices.

## Resources and continued learning

Ongoing learning ensures the Node Social team stays current with Expo ecosystem evolution and best practices.

**Official documentation and references**

The Expo documentation at docs.expo.dev provides comprehensive guides, API references, and tutorials. SDK 54 specific resources include the changelog at expo.dev/changelog/sdk-54, beta announcement at expo.dev/changelog/sdk-54-beta, and upgrade guide at expo.dev/blog/expo-sdk-upgrade-guide. Key guides for social media include authentication at docs.expo.dev/develop/authentication/, using Supabase at docs.expo.dev/guides/using-supabase/, and file-based routing at docs.expo.dev/router/introduction/.

React Native documentation at reactnative.dev covers core components and APIs. React Native 0.81 release notes at reactnative.dev/blog/2025/08/12/react-native-0.81 detail new features and changes. The New Architecture guide at reactnative.dev/docs/the-new-architecture/landing-page explains architectural improvements and migration paths.

**Community resources and support channels**

The Expo Community Discord at chat.expo.dev hosts over 65,000 members with active daily discussions. Weekly office hours on Wednesdays at 12:00PM Pacific provide direct access to Expo team members. The Discord offers channels for specific topics, beta testing opportunities, and real-time help from experienced developers.

Additional community channels include Expo Forums at forums.expo.dev for longer-form discussions, r/expo subreddit for Reddit users, React Native Discord via reactiflux.com, and social media including @expo on Twitter/X, expo.dev on Bluesky, Expo company page on LinkedIn, and the Expo YouTube channel with tutorials and conference talks.

GitHub resources include the main repository at github.com/expo/expo for issues and source code, React Native Directory at reactnative.directory for searchable library database, and example projects at github.com/expo/examples demonstrating various features.

**Essential third-party libraries for Node Social**

UI libraries provide pre-built components. Tamagui offers best-in-class performance with compiler optimization, cross-platform support including web, and atomic styling with excellent documentation at tamagui.dev. React Native Paper implements Material Design with comprehensive components at callstack.github.io/react-native-paper/. Gluestack UI (successor to deprecated NativeBase) provides 40+ components with design tokens at gluestack.io.

State management libraries handle different needs. TanStack Query manages server state with automatic caching at tanstack.com/query. Zustand provides lightweight client state at zustand-demo.pmnd.rs. Redux Toolkit handles complex global state at redux-toolkit.js.org.

Form handling libraries include React Hook Form at react-hook-form.com for performance-focused uncontrolled forms, and Formik at formik.org for complex field-level validation.

List performance improves with @shopify/flash-list providing 54% FPS improvement over FlatList. Animation libraries include react-native-reanimated for advanced animations (requires New Architecture in v4) and react-native-gesture-handler for native gesture recognition.

**Learning paths for advanced topics**

Custom native modules using Expo Modules API enable building native functionality with unified APIs. Documentation at docs.expo.dev/modules/overview/ covers creating Swift and Kotlin modules with auto-generated TypeScript types.

Advanced animations with Reanimated v4 require understanding worklets, shared values, and gesture integration. Migration guide at docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x/ helps transition from v3.

Performance optimization mastery involves analyzing with Expo Atlas, profiling with Hermes profiler, optimizing bundle size with tree-shaking, and implementing advanced caching strategies.

Backend integration options include Supabase for open-source PostgreSQL with authentication, storage, and real-time subscriptions at supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native. Firebase provides comprehensive backend services at rnfirebase.io with authentication, Firestore, and cloud functions.

**Example projects and starter templates**

Social media starters provide architectural examples. Search github.com for "expo social media" to find starter projects with authentication, feed implementation, and media handling. The Expo Router + Tamagui starter at github.com/tamagui/starter-free combines modern routing with performant UI components.

Authentication examples demonstrate OAuth flows. Supabase social auth example at github.com/supabase/supabase/tree/master/examples/auth/expo-social-auth shows Google, Apple, and other providers implementation.

**Video content and courses**

The SDK 54 overview video at youtube.com/watch?v=iYh-7WfJTR0 explains major features and changes. The Expo YouTube channel provides live streams, feature demonstrations, and conference talks.

Community courses include notJust.dev at news.notjust.dev offering comprehensive React Native and Expo courses. Callstack blog at callstack.com/blog publishes weekly livestreams and technical articles.

Medium articles provide practical guides. "What's New in Expo SDK 54" at medium.com/@onix_react/whats-new-in-expo-sdk-54-1e93fe77d7a7 summarizes major features. "Upgrading to Expo 54 and React Native 0.81: A Developer's Survival Story" at medium.com provides migration experiences and solutions.

**Staying current with updates**

Subscribe to the Expo blog at expo.dev/blog for official announcements and technical deep dives. Follow @expo on social media for real-time updates. Join the Discord announcements channel for release notifications.

Enable Dependabot or Renovate in GitHub repositories for automated dependency update pull requests. Review and test updates regularly. Keep EAS CLI and Expo CLI updated to latest versions for bug fixes and new features.

Participate in beta programs by joining the Discord #sdk-beta channel, testing pre-release versions in separate branches, and providing feedback on new features to influence SDK development.

---

This comprehensive guide equips the Node Social development team with everything needed to build a production-quality social media platform using Expo SDK 54. The combination of modern tooling, performance optimizations, and battle-tested patterns provides a solid foundation for rapid development without sacrificing quality or user experience. As the team grows familiar with these patterns, development velocity will increase while maintaining code quality and consistency across the codebase. The investment in proper architecture, testing, and tooling pays dividends as the platform scales to thousands or millions of users.