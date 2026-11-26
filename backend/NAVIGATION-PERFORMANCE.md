# Navigation performance

Changes preserve ordinary full-document navigation, staff authorization, CAPTCHA and payment/license contracts.

- Brand PNG originals remain for social previews/rollback. Rendered brand images use transparent WebP at900×300, adequate for the established maximum450 CSS-pixel display (2× density). Combined asset bytes:1008136 →112028 (-88.9%). This is an image-byte reduction, not a measured end-to-end latency percentage.
- Image width/height establish aspect ratio; decoding is asynchronous. Header brand has high fetch priority.
- Removed Google Fonts CSS @import waterfall. Manrope remains the same; its stylesheet is directly discoverable in HTML with font-origin preconnects. Unused DM Sans declaration removed. Font display remains swap.
- navigation.js prefetches at most4 allowlisted public documents on pointer/focus/touch intent. Skips data-saver/2G, private routes, forms, APIs, queries, fragments, cross-origin targets and downloads. Browser support/cache policy may decline a hint. No service worker or interception of clicks.
- Long management lists use progressive content-visibility rendering in supporting browsers. Other browsers retain normal rendering. Reduced-motion preference disables smooth scrolling/animations.
- APK history shares an in-flight request and reuses rendered data for30 seconds. Explicit Refresh and successful upload/notes/publication/deletion force a fresh query. Memory only; no persistent staff-data cache.

Validation: node backend/navigation-performance-tests.mjs, node backend/apk-download-tests.mjs, JS syntax and git diff checks. Local browser: home branding loaded with existing dimensions, no horizontal overflow, Home→Compatibility navigation worked. Authenticated production timing and physical-phone performance were not benchmarked. No Supabase function/schema changed.
