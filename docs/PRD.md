# QuizGeni - Product Requirements Document

## Produktöversikt

- **Namn:** Quizla.app
- **Tagline:** "Snap. Quiz. Ace."
- **Målgrupp:** Studenter som vill effektivisera sitt lärande via mobilen
- **Plattform:** PWA (Progressive Web App) - mobile-first
- **Design:** Dark mode default, youth-focused, gamification elements

---

## Implementerade Features ✅

### Kärnfunktioner
- 📸 **Fota/ladda upp studiematerial** - Bildkomprimering för optimal balans mellan kvalitet och storlek. Automatisk HEIC→JPEG-konvertering för iPhone-bilder.
- 🤖 **AI-driven textextraktion** - Gemini 2.5 Flash för OCR och innehållsanalys. Skydd mot dubbel-analys (redan analyserade filer hoppas över för att spara AI-tokens).
- 📝 **Automatisk quiz-generering** - Pedagogisk AI med "lärarpersonlighet" (20+ års erfarenhet). Använder Bloom's taxonomi för progressiv svårighet (20% remember → 25% evaluate/create). Anpassad för svenska betygskriterier — frågor kräver utvecklade resonemang för högsta betyg.
- 🎯 **Materialklassificering** - Tre typer: content, learning_objectives, reference. Learning objectives styr quiz-generering (varje mål måste ha minst en fråga). Content används som frågekälla. Reference ger enbart kontext.
- 🔄 **Quiz-variation** - Vid multipla quizzes på samma material genereras automatiskt nya vinklar, ämnen och Bloom-nivåer. Befintliga frågor skickas till AI:n för att undvika överlappning. Testad variation: ~85% unika ämnen mellan quiz 1 och 2.
- 🧠 **Misconception-driven distraktorer** - Felaktiga svarsalternativ baseras på vanliga elevmissförstånd, inte slumpmässiga felaktigheter. Varje distraktor är diagnostiskt användbar.
- 🔊 **Text-to-speech** - ElevenLabs för "Read it for me" på svenska
- 📁 **Collections** - Organisera material och quizzes
- 📊 **Analytics & Admin** - Quiz-historik, prestationsöversikt, och admin-dashboard med kostnadsrelaterad statistik (uppladdade filer, AI-analyser, genererade frågor, lagring)
- 📄 **PDF-export** - Exportera studiematerial

### Tekniska Features
- Real-time progress tracking vid innehållsextraktion
- Bildkomprimering browser-side (1.5MB/1800px)
- Flerspråksstöd - bevarar källspråk i analys
- HEIC/HEIF-stöd via client-side konvertering

---

## Roadmap

### Fas 1: Användarvärvning (NU) 🎯
- [ ] Landing page optimering
- [ ] Onboarding-flöde för nya användare
- [ ] Social sharing av quiz-resultat
- [ ] Grundläggande användningsanalytics
- [ ] App Store/Play Store presence (PWA)

### Fas 2: Engagement & Retention

#### 🔄 Spaced Repetition System (SRS) ⭐ PRIORITERAD

**Syfte:** Hjälpa studenter att minnas mer med mindre studietid genom vetenskapligt bevisade repetitionsintervall.

**Implementation:**

1. **Datamodell**
   ```
   review_schedule tabell:
   - id (UUID)
   - user_id (UUID → profiles)
   - question_id (UUID → questions)
   - next_review_at (TIMESTAMP)
   - interval_days (INTEGER, default 1)
   - ease_factor (DECIMAL, default 2.5)
   - repetition_count (INTEGER, default 0)
   - last_reviewed_at (TIMESTAMP)
   ```

2. **SM-2 Algoritm**
   - Rätt svar: `interval = interval × ease_factor`, ease_factor ökar
   - Fel svar: `interval = 1`, ease_factor minskar
   - Minimum ease factor: 1.3

3. **Edge Functions**
   - `calculate-review-schedule` - Beräknar nästa review efter quiz
   - `get-due-reviews` - Hämtar frågor som behöver repeteras

4. **UI Komponenter**
   - Dashboard: "Review Due" card med antal och CTA
   - `/review` page: Dedikerat quiz-läge för repetition
   - Mastery-procent per collection

**Framgångsmått:**
- Retention improvement (Day 7, Day 30)
- Review session completion rate
- Average mastery percentage

---

#### 🔥 Streak Tracking

**Syfte:** Skapa dagliga vanor och motivation genom gamification.

**Implementation:**
- `current_streak` och `longest_streak` i profiles
- Visuella streak-badges på dashboard
- Dagliga mål (t.ex. "Repetera 10 frågor")
- Belöningar vid milstolpar (7 dagar, 30 dagar, etc.)

---

### Fas 3: Advanced Features

- 📱 **Push Notifications** - Påminnelser om reviews och streak
- 🃏 **Flashcard-läge** - Swipe-gester för snabb repetition
- 💬 **AI Study Companion** - Ställ frågor om materialet
- 📴 **Offline-läge** - Studera utan internet
- 👥 **Social Learning** - Dela collections med klasskompisar

---

## Teknisk Arkitektur

| Lager | Teknologi |
|-------|-----------|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | Lovable Cloud (Supabase) |
| AI/ML | Lovable AI (Gemini 2.5 Flash/Pro) |
| Text-to-Speech | ElevenLabs API |
| Hosting | Lovable (staging), Custom domain (prod) |

### Design Principles
- **Mobile-first** - Primär användning på telefon
- **Dark mode** - Default för ögonkomfort
- **Less is more** - Minimalistiskt UI, fokus på innehåll
- **Separation of concerns** - Data → Model → View

---

## Framgångsmått

| Mått | Mål | Beskrivning |
|------|-----|-------------|
| MAU | - | Monthly Active Users |
| Quiz Completion Rate | >80% | Andel påbörjade quizzes som avslutas |
| Day 1 Retention | >40% | Användare som återvänder dag 2 |
| Day 7 Retention | >20% | Användare som återvänder efter en vecka |
| Day 30 Retention | >10% | Användare som återvänder efter en månad |
| Avg Session Length | >5 min | Tid per session |
| Review Completion | >70% | (Framtid) Andel som slutför review sessions |

---

## Konkurrensfördel

1. **Eget material** - Quizzes baserade på studentens egna anteckningar, inte generiskt innehåll
2. **Mobile-first** - Optimerat för hur studenter faktiskt studerar
3. **AI-driven** - Automatisk extraktion och quiz-generering
4. **Språkstöd** - Bevarar källspråk (viktigt för svenska studenter)
5. **SRS** (kommande) - Vetenskaplig repetition för bättre retention

---

*Senast uppdaterad: 2025-11-28*
