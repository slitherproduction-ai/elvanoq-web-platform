# Portal languages

The portal supports Portuguese and English on all 18 pages. The header selector stores the choice in `elvanoq_portal_language`. A first visit uses the browser language (English or Portuguese fallback). `?lang=en` and `?lang=pt` override the initial choice. Switching language does not reload the page or change form values, identifiers, URLs, API bodies, access rules or payment amounts.

Edit `dist/i18n-en.json`, then run `python3 scripts/build-i18n.py`. The script generates `dist/i18n-en.js` and refreshes the language asset hashes on all HTML pages. The DOM translator also handles asynchronously created labels, known messages and pagination. Unknown server messages fall back to their original text; release notes, user-entered values and tutorial audio retain their source language. No external translation service is used.

Validation: `node --test tests/i18n.test.cjs tests/device-filters.test.cjs tests/playback-diagnostics.test.cjs`. Browser checks covered language detection, round-trip switching, navigation persistence, VIDAA dynamic instructions and preserving unsent form input. Production payment and authenticated management mutations were not performed as part of language testing.
