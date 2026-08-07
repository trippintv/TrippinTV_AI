# Google Play Store Listing — Trippin' TV

Copy-paste guide for the Play Console submission. Last reviewed: August 7, 2026.

---

## 1. App basics

| Field | Value |
|---|---|
| App name | Trippin' TV |
| Default language | English (US) |
| Category | Entertainment |
| Price | Free |
| App type | Social (User-generated content + video) |
| Install | Free |
| Apps & Games | App |
| Application ID / package | `tv.trippin.app` |
| Release type | Production (first release) |
| Target audience | 13+ (UGC + ads) |
| App access | All functionality is available for free; some AI features use an in-app credits system |

## 2. Short description (max 80 chars)

> Crazy videos, votes, and real prizes. Post trips, chat, and climb the leaderboard.

## 3. Full description (max 4000 chars)

> Trippin' TV is the home of the wildest videos on the internet. Post your craziest trips, watch short-form clips, and vote to send them to the top.
>
> WHAT YOU CAN DO:
> • Post short videos and share your wildest moments
> • Vote ("Trip") and react to the best content
> • Earn credits for posting, voting, and daily logins
> • Generate AI videos straight from a text prompt
> • Chat with friends, follow creators, and climb the leaderboard
> • Win real prizes — earn points and compete in weekly rankings
>
> AI VIDEO GENERATOR:
> Generate unique short-form videos with our built-in AI tool. Videos created with AI are clearly labelled "AI-generated" in the feed.
>
> SAFETY:
> Your safety matters. Every video, post, comment, and message is monitored, and you can report content or block any user from your profile. Read our Community Guidelines in the app and our Terms of Service and Privacy Policy on our website.
>
> Note: Trippin' TV contains user-generated content and advertising. Some features use a credits system that can be earned in-app or by watching rewarded ads. Prizes are subject to the official contest rules.

## 4. Store listing assets

- **Feature graphic** (1024×500, required, no text beyond logo in top-left/bottom-right safe zone)
- **Phone screenshots** (min 2, recommended 8; JPEG/PNG 24-bit; min 320px, max 3840px):
  1. Video feed — vertical video card with vote buttons
  2. AI video generator modal with prompt input
  3. Leaderboard with rankings
  4. Profile page with username + points + credits
  5. Chat / friends screen
- **App icon**: already set (`ic_launcher.png`, all densities)
- **Content rating**: complete questionnaire in Play Console (answers below)
- **Privacy policy URL**: `https://trippintv-ai.onrender.com/privacy`
- **App category**: Entertainment

## 5. Content rating questionnaire (answers)

App is NOT exclusively for children and is NOT designed specifically for children.
Contains interactive elements: **digital purchases/shares** — set: users can share location? No. 
Recommendation: run the questionnaire with these answers:
- Alcohol/Tobacco/Drugs: No (may be shown in UGC, select "no direct content" — review UGC setting)
- Sexual content: Moderate — UGC may contain adult themes, no explicit material
- Violence: Yes — UGC can include dangerous stunts; "moderate" with viewer discretion
- Controlled substances: No
- Gambling: No real-money gambling (rewards are contest-based, not chance-based monetization)
- Profanity: Moderate — UGC may contain mild profanity (filtered by moderation)
- Unfiltered internet/UGC access: Yes — user-generated content is shared
- **Important**: Google requires apps with UGC that are NOT directed at children to self-rate at least "Mature 17+" **only if** UGC is unfiltered for adult content. Because we have active moderation + the app targets a broad audience, "Teen" (PEGI 12) is defensible. If the reviewer flags it, re-run as "Mature" (PEGI 16/18).
- Expected final rating: **Teen (PEGI 12)** or higher, depending on questionnaire.

## 6. Data Safety form (answers to declare)

**Data collected — all are "shared" and "collected":**
- App info & performance: crash logs ✅, diagnostics ✅, other app performance data ✅
- Personal info: name ✅, email address ✅, user IDs ✅, other identifiers (device/ad IDs via AdMob) ✅
- Photos and videos: photos ✅ (avatar), videos ✅ (uploads + AI-generated videos)
- Messages: in-app messages ✅ (chat)
- User content: comments, posts, files, votes, other user content ✅

**Data NOT collected:** Location (no precise/approx), Contacts, Financial info (no card/payment details), Health/fitness, Biometrics, Web browsing history, Purchase history, Calendar, Audio recordings (no microphone), Phone number, SMS.

**Data handling:**
- Data is encrypted in transit (HTTPS/TLS) ✅
- You can request deletion — add "request account deletion" (see §7)
- Data is used only as described in the privacy policy; **not sold** ✅
- **Not** used for personalised ads UNLESS consent is given → declare "This app does NOT share data with third parties for personalised advertising" but note Google AdMob may collect IDs for interest-based ads where legally permitted. In the Data Safety form select "personalised ads" = Yes (since AdMob serves them), and link the ad partner (Google).
- Account deletion: Provide in-app option (recommended) or the email privacy@trippintv.tv

## 7. Required: Account deletion / data deletion

Play requires a working account-deletion option. Implemented:
- **Done**: "Delete Account" button in Profile → removes all user content (videos, posts, comments, messages, reactions, follows, friends, notifications, blocks) from the DB, then deletes the Supabase auth user. Server: `DELETE /api/users/me`.
- Fallback for support: email `privacy@trippintv.tv` from the registered address.

## 8. Ads declaration

- This app **does** contain ads: AdMob (Google).
- Declared in Data Safety: advertising IDs collected by Google AdMob.
- If you enable personalized ads, Google will prompt for consent via the Google UMP SDK where required (EU/UK). Not yet integrated — see TODO.

## 9. Pre-launch checklist

- [ ] Add billing to Replicate (AI video generator — currently returns 402)
- [x] Add account deletion flow (§7)
- [ ] Upload signed AAB from CI (android app-release-aab artifact)
- [ ] Run pre-launch report in Play Console on the AAB
- [ ] Fill data safety form (§6)
- [ ] Set privacy policy URL
- [ ] Content rating questionnaire (§5)
- [ ] Store listing: screenshots, feature graphic, category
- [ ] Confirm UGC moderation: in-app report ✅ + block ✅ + TOS/guidelines ✅
- [ ] (Recommended) Integrate Google UMP consent for ads in EU/UK
