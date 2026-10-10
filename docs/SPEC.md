INSIDE THE GAME
AI Audience Intelligence Platform
Complete Product Specification
PRD • TRD • UI/UX • App Flow • Backend Infrastructure • Implementation Plan
Hackathon MVP Specification
Executive Summary
Inside the Game is an AI-powered football experience that turns participating audience phones into a distributed stadium camera and intelligence network. Instead of relying only on official broadcast cameras, the platform transforms audience-captured photos, videos, reports and signals into a structured, chronological live “Moments” feed.
The fan experience feels like an FYP: scroll, see a moment, understand what happened, explore other angles, and continue through the match. The same infrastructure can identify and surface potential safety incidents.
Core proposition: Every fan can be another angle on the game. AI turns all those angles into one intelligent live story.
1. Product Requirements Document (PRD)
1.1 Product Vision
Build an AI-powered football experience that turns participating audience phones into a distributed stadium camera and intelligence network.
The platform continuously transforms audience-captured photos, videos, reports and signals into a live “Moments” feed while providing an AI-assisted stadium safety layer.
1.2 Problem
Fragmented fan footage: hundreds of people may capture the same goal, but footage is scattered across personal devices and social platforms.
Missed perspectives: the official broadcast can miss the exact reaction or angle a fan captured.
Delayed storytelling: important moments often require manual editing before becoming usable content.
Disconnected stadium safety: audience members may witness an incident before stadium operators do, but there is no unified intelligent layer connecting those reports.
1.3 Proposed Solution
The application creates an AI-generated live timeline of the match. Audience media enters the system, AI analyzes it, the system determines what happened, when, where and who/what is involved, finds related uploads, ranks the best media, and creates a Moment.
72:14⚽ GOALPlayer #9 scores.18 audience captures7 usable angles72:18🔥 CROWD CELEBRATION23 photos11 videos73:04🚨 SAFETY ALERTPossible medical incidentSection B3 audience reportsAI confidence: 91%
1.4 Goals
Create an engaging FYP-style live match experience.
Use AI to automatically organize audience media.
Combine multiple recordings into unified Moments.
Provide multiple perspectives of important events.
Demonstrate real-time AI processing.
Provide AI-assisted stadium safety reporting.
Demonstrate meaningful use of Microsoft/Azure technologies.
Produce a convincing end-to-end hackathon prototype.
1.5 Non-Goals for the Hackathon
Full professional broadcast replacement.
Continuous high-resolution livestream from every phone.
Complete stadium surveillance.
Biometric or facial identification.
Automatic emergency dispatch.
Production-grade stadium integrations.
Monetization system.
Full social network.
Complicated recommendation algorithms.
1.6 Target Users
User
Needs
Fan
Follow a match, see multiple angles, capture moments, discover nearby footage, report emergencies.
Stadium Security
Receive incidents quickly, see location/section, supporting media, severity and clustered reports.
Content/Broadcast Team
Find fan footage, discover angles, identify important moments and generate content quickly.
Admin
Manage matches, stadiums, players, users, moderation, incidents and AI configuration.
1.7 Core User Journeys
Fan watches match
Open app → Select match → Enter Match Feed → Scroll Moments → Watch → Explore angles → Continue
Fan captures goal
Capture → Upload → AI analysis → Goal detected → Find same event → Group other captures → Create Moment → Publish
Fan reports emergency
SOS → Confirm → Optional media → Location/section → AI classification → Cluster reports → Security receives alert
Security receives incident
New incident → Location/severity → Supporting media → AI classification → Acknowledge → Assign → Resolve
1.8 Feature Requirements
Priority
Features
P0
Live match timeline; FYP vertical feed; image/video Moments; timestamps; event categories; player association; multi-media Moments; capture/upload; AI classification; event clustering; confidence; captions; media ranking; multi-angle view; SOS; incident classification; security dashboard.
P1
Player-specific feed; match search; fan profiles; reactions; share/save; multilingual summaries; AI match recap; incident heatmap; moderation queue.
P2
Automatic highlight reel; broadcaster export; club integrations; wearables; AR; advanced tactical analysis; predictive safety intelligence; monetization/licensing.
1.9 Moment Object
A Moment is the fundamental unit of the product.
Moment├── id├── match_id├── timestamp├── event_type├── title├── description├── player_ids[]├── confidence├── location├── media[]├── best_media├── source_count└── created_at
1.10 Success Metrics
Metric
Hackathon Target
Media classification accuracy
>85%
Same-event clustering accuracy
>80%
Moment creation latency
<30 sec
Feed update latency
<5 sec after publication
Upload success
>95%
AI caption generation
<10 sec
SOS acknowledgement
<5 sec
App crash rate
<2%
1.11 Product Success
The demo succeeds when a judge can experience the complete loop: a user records something, AI understands it, finds other perspectives, creates a Moment, pushes it into the live feed, and then demonstrates an AI-assisted safety incident flowing into the security dashboard.
2. Technical Requirements Document (TRD)
2.1 Technical Architecture
MOBILE APP (React Native / Expo)        │   REST + WebSocket        │   API LAYER        │  Event / Job Layer        │   Azure Event Hubs   ┌────┼───────────┐   ↓    ↓           ↓  AI   Media     AnalyticsWorker Worker      Worker   │    │           │   ↓    ↓           ↓Foundry Blob     FabricVideo AI Storage        │    PostgreSQL        │   Moment Engine        │    Web PubSub        │     Fan Feed
2.2 Recommended Stack
Layer
Technology
Mobile
React Native, Expo, TypeScript, Expo Camera, Expo Location, Expo Notifications, React Query, Zustand
Web/Admin
Next.js, TypeScript, Tailwind CSS, shadcn/ui, Recharts
Backend
Node.js, TypeScript, Fastify or Express, Zod, Prisma
Database
Azure Database for PostgreSQL
Storage
Azure Blob Storage
Events
Azure Event Hubs
Realtime
Azure Web PubSub
AI
Microsoft Foundry
Video AI
Azure AI Video Indexer
Analytics
Microsoft Fabric + Power BI
Secrets
Azure Key Vault
Monitoring
Application Insights
CI/CD
GitHub Actions
2.3 AI Pipeline
MEDIA UPLOAD     ↓Create media record     ↓Blob Storage     ↓media.uploaded     ↓AI analysis worker     ↓Event classification / quality / player / description / safety     ↓Normalized AI result     ↓Moment matching engine     ↓Existing Moment? → YES: attach media                 → NO: create Moment     ↓Publish update     ↓Web PubSub     ↓FYP
2.4 Same-Moment Clustering
The MVP should not group uploads only by exact timestamp. Use same match, timestamp proximity, event type, semantic similarity, and optionally location/section.
MVP:same_matchAND |timestamp_difference| <= 10 secondsAND semantic/event similarity >= thresholdFuture:embedding similarity+ visual embeddings+ audio spike+ event classification
2.5 Media Ranking
Rank each media asset using quality, event relevance, visual clarity, duration, camera angle, AI confidence and upload latency. The FYP should show the strongest representation first rather than immediately showing every clip.
2.6 Database Schema
Table
Core Fields
users
id, name, email, avatar_url, role, created_at
matches
id, home_team, away_team, scores, stadium_id, status, start_time
stadiums
id, name, latitude, longitude, capacity
players
id, team_id, name, number, position, avatar_url
media
id, user_id, match_id, blob_url, thumbnail_url, type, duration, timestamps, location, section, status
ai_analysis
id, media_id, event_type, confidence, description, players, severity, labels, model, processed_at
moments
id, match_id, event_type, timestamp, title, description, confidence, best_media_id, status, created_at
moment_media
moment_id, media_id, angle_label, rank
incidents
id, match_id, reported_by, type, severity, location, section, description, status, confidence, timestamps
incident_media
incident_id, media_id
reactions
id, moment_id, user_id, type
2.7 API Design
AUTHPOST /auth/registerPOST /auth/loginPOST /auth/refreshPOST /auth/logoutMATCHESGET /matchesGET /matches/:idGET /matches/:id/feedMEDIAPOST /media/upload-urlPOST /mediaGET /media/:idDELETE /media/:idMOMENTSGET /momentsGET /moments/:idGET /moments/:id/mediaPOST /moments/:id/reactionINCIDENTSPOST /incidentsGET /incidentsGET /incidents/:idPATCH /incidents/:id/statusADMINPOST /matchesPATCH /matches/:idPOST /playersGET /analyticsGET /moderation
2.8 Real-Time Channels
match:{matchId}moment:{momentId}security:{stadiumId}admin:{adminId}
A new Moment is published to the match-specific channel so connected fans receive the update without refreshing.
2.9 Security Requirements
JWT/access tokens with refresh-token rotation.
Role-based access: FAN, MODERATOR, SECURITY, ADMIN.
Private Blob containers and signed upload/playback URLs.
Never expose storage keys.
Do not expose exact fan GPS coordinates publicly; use section-level location in the public experience.
SOS should use confirmation or press-and-hold to reduce accidental alerts.
2.10 Moderation
Public media states: PROCESSING, APPROVED, FLAGGED, REJECTED, REMOVED. AI should recommend moderation decisions, not silently make irreversible decisions in sensitive safety contexts.
3. UI/UX Design
3.1 Design Direction
Visual direction: TikTok × live sports × premium broadcast dashboard. Use a dark stadium environment, large media, minimal chrome, strong typography, event-first presentation, subtle animations, edge-to-edge media and clear live indicators.
Avoid excessive cards, huge dashboards, gradients everywhere, excessive badges, clutter and generic AI UI.
3.2 Bottom Navigation
HOME     LIVE     CAPTURE     ALERT     PROFILE
3.3 Home / Live FYP
LIVEArsenal 1 - 0 Chelsea[EDGE-TO-EDGE VIDEO]GOAL! ⚽72:14#9 scores18 angles · 7 photosSwipe up → next MomentTap → Moment details
3.4 Moment View
GOAL72:14        [VIDEO]AI SUMMARY#9 finishes inside the box aftera through ball from #7.18 audience captures[1] [2] [3] [4]NORTH STAND / EAST STAND / BEHIND GOAL
3.5 Player View
PLAYER#9 — ForwardMATCH MOMENTS⚽ Goal — 72:14🔥 Celebration — 72:20🎥 Shot — 58:32
3.6 Capture Screen
[ CAMERA ]Photo | Video[ Capture Moment ]Share with:● Match community○ Only me○ Security only
3.7 SOS Screen
ARE YOU IN DANGER?        [ HOLD TO ALERT ]MedicalSecurityFireOvercrowdingOther
3.8 Security Dashboard
STADIUM LIVE INTELLIGENCEINCIDENTS             LIVE MATCH🔴 2 Critical         [MATCH FEED]🟠 4 Medium🟢 18 Normal             STADIUM MAP             🔴   🟠                  🟠MEDICAL INCIDENTSection CConfidence: 91%3 reports · 2 videos[DISPATCH] [ACKNOWLEDGE] [RESOLVE]
3.9 Interaction Model
Gesture / Action
Result
Swipe up
Next Moment
Tap
Open Moment
Double tap
React
Long press
Report media
Horizontal swipe
Change camera angle
Tap player
Open player timeline
3.10 AI Loading States
AI IS ANALYZING THIS MOMENT...Event detected ✓Player identified ✓Other angles found ✓Moment ready ✓
4. App Flow
4.1 First Launch
Splash → What are you watching? → Select match → Optional stadium section → Permissions → Home
4.2 Match Flow
Home → Select Match → Live Feed → Scroll → Moment → Multiple Angles → Player/Event → Feed
4.3 Capture Flow
Live Feed → Capture → Camera → Record → Preview → AI processing → Classification → Moment matching → Published
4.4 Safety Flow
Alert → Hold SOS → Select type → Location → Optional media → Submit → AI classification → Incident clustering → Security → Acknowledge → Resolve
4.5 Content Team Flow
Dashboard → Live Match → Moments → Select Event → Review angles → Select media → Generate recap → Export/share
5. Backend Infrastructure
5.1 Production-Style Architecture
USERS  ↓React Native App  ↓ HTTPS / WebSocketAzure API / Container Apps  ↓PostgreSQL | Blob Storage | Event Hubs  ↓AI Workers | Video AI | Fabric Analytics  ↓Moment Engine  ↓Azure Web PubSub  ↓Fan Feed / Security Dashboard
5.2 Repository Structure
inside-the-game/├── apps/│   ├── mobile/│   ├── admin/│   └── api/├── packages/│   ├── types/│   ├── ui/│   ├── ai/│   ├── database/│   └── config/├── workers/│   ├── media-analysis/│   ├── moment-engine/│   └── incident-engine/├── infrastructure/│   ├── azure/│   └── github/└── docs/    ├── PRD.md    ├── TRD.md    ├── APPFLOW.md    └── API.md
5.3 Processing Queues
MEDIA_UPLOAD_QUEUEAI_ANALYSIS_QUEUEMOMENT_MATCH_QUEUEMODERATION_QUEUEINCIDENT_QUEUE
Each worker should be independently retryable.
5.4 AI Result Contract
{  "eventType": "goal",  "confidence": 0.97,  "description": "A player scores from inside the box.",  "players": [],  "severity": "normal",  "safetyRelevant": false,  "tags": ["goal", "celebration"]}
The frontend should depend on a normalized AI result contract rather than model-specific responses.
5.5 Failure Handling
Failure
Response
AI unavailable
Keep media in PROCESSING and retry.
Upload fails
Resume/retry.
Realtime disconnects
Fall back to polling.
Duplicate upload
Use hash plus metadata to detect duplicates.
False safety alert
Allow security to mark false_positive and record it for analytics.
6. Implementation Plan
The hackathon should prioritize a complete proof of the concept rather than implementing every future feature.
Phase 1 — Foundation (Day 1)
Repository; React Native Expo; admin app; API; PostgreSQL; Prisma.
Azure resource group, Blob Storage, Event Hubs, Web PubSub, Foundry project.
Deliverable: apps boot and connect to backend.
Phase 2 — Match Experience (Days 2–3)
Match list; match page; vertical FYP; Moment component; video player; image viewer; multi-angle viewer.
Deliverable: polished static match feed.
Phase 3 — Media Ingestion (Days 4–5)
Camera; gallery picker; upload; Blob Storage; progress; media records; thumbnails.
Deliverable: phone → Azure Blob → database.
Phase 4 — AI (Days 6–8)
Media classification, description, confidence, event types: goal, celebration, player, crowd, foul, security, other.
Deliverable: upload a clip and receive AI event metadata.
Phase 5 — Moment Engine (Days 9–10)
Same-event clustering using match, timestamp proximity and event similarity; group media; rank best media.
Deliverable: multiple videos automatically become one Moment.
Phase 6 — Realtime Feed (Day 11)
Connect Moment Engine → Web PubSub → Mobile Feed.
Deliverable: feed updates without refresh.
Phase 7 — Security (Days 12–13)
SOS; incident form; location; severity; media; AI classification; security dashboard; incident map.
Deliverable: fan report appears in security dashboard.
Phase 8 — Fabric Analytics (Day 14)
Send events to Fabric; show total Moments, media per Moment, fan participation, event frequency, incidents and match timeline.
Deliverable: one real-time analytics dashboard.
Phase 9 — Polish (Days 15–16)
Animations, typography, loading states, playback, errors, empty states, onboarding and permissions.
Deliverable: judge-ready UX.
Phase 10 — Demo Mode (Day 17)
Pre-load simulated Fan A–E footage and staged event timeline.
Demonstrate upload → AI → clustering → Moment → multiple angles and SOS → security.
Phase 11 — Testing (Day 18)
Test uploads, AI processing, clustering, realtime feed, SOS, dashboard, network failure, duplicates, bad media and permissions.
Phase 12 — Submission (Day 19)
README, architecture, demo instructions and 2–3 minute demo video.
Pitch: Problem → audience phones are unused data → AI solution → safety layer → Microsoft technology → live demo → impact.
7. AI System Design
Use specialized AI components/agents rather than a single generic chatbot.
Component
Responsibility
Moment Analyst
Analyze media and return event, players, description and confidence.
Moment Matcher
Determine whether new media belongs to an existing Moment or creates a new one.
Highlight Curator
Rank the strongest footage for a Moment.
Storyteller
Generate Moment titles, descriptions, match recaps and player summaries.
Safety Analyst
Analyze incident reports/media and return type, severity, confidence and evidence.
Security Coordinator
Combine multiple reports, locations, timestamps and media into one incident.
8. Hackathon MVP Definition
                    MVP              MATCH SELECTION                     │                     ↓             FYP MOMENTS FEED                     │              ┌──────┴──────┐              ↓             ↓           PHOTO          VIDEO              │             │              └──────┬──────┘                     ↓                 AI ANALYSIS                     ↓             EVENT CLASSIFIER                     ↓            MOMENT CLUSTERING                     ↓              MULTI-ANGLE VIEW                     ↓              REAL-TIME UPDATE                     +                    SOS                     ↓              AI CLASSIFICATION                     ↓             SECURITY DASHBOARD
9. Demo Script
Open the app and select Arsenal vs Chelsea (or the chosen demo match).
Show the live FYP Moments feed.
Simulate a goal and capture it from a fan device.
Upload the clip and show AI analyzing it.
AI identifies the goal, player and confidence.
Show the system finding other audience footage.
Open the Moment and swipe between multiple angles.
Return to the feed and show the new Moment appearing in real time.
Trigger a simulated medical/safety incident.
Show AI classification and the security dashboard updating instantly.
Finish with analytics: audience captures, AI Moments, multi-angle events and safety reports.
10. Core Product Positioning
Do not position the product as “TikTok for football.” The stronger proposition is:
“AI turns hundreds of independent audience recordings into a live, intelligent timeline of everything happening inside the stadium.”
The strongest technical story is: Audience phones → media → AI → event intelligence → multi-angle Moments → real-time feed → safety intelligence → analytics.
11. Important Product Decision
Do not position the first version as “everyone's phone livestreams constantly.” That creates immediate problems around battery, bandwidth, privacy and scalability.
Position it as AI-powered crowd capture. Phones contribute moments, not necessarily continuous video. The MVP can use short clips and event-triggered capture.
Future architecture:rolling camera buffer↓AI detects important event↓preserve previous 5 seconds + next 10 seconds↓upload automatically
This can later become the foundation for a larger crowd-sourced live camera network.
12. Final Product Structure
INSIDE THE GAME│├── FAN APP│   ├── FYP Moments│   ├── Live Match│   ├── Capture│   ├── Player Moments│   ├── Multi-angle Replay│   └── SOS│├── AI ENGINE│   ├── Moment Analyst│   ├── Moment Matcher│   ├── Highlight Curator│   ├── Storyteller│   └── Safety Analyst│├── REAL-TIME ENGINE│   ├── Event Hubs│   ├── Moment Engine│   └── Web PubSub│├── MEDIA PLATFORM│   ├── Blob Storage│   ├── Video AI│   └── Media Ranking│├── SECURITY PLATFORM│   ├── Incident Detection│   ├── Incident Clustering│   ├── Stadium Map│   └── Security Dashboard│└── ANALYTICS    ├── Microsoft Fabric    ├── Real-Time Intelligence    └── Power BI
Document prepared as a hackathon-ready working specification. Architecture and Microsoft service choices should be validated against the current hackathon rules, quotas and available service tiers before implementation.