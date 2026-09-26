// Texte der öffentlichen Website. Jede Funktionsaussage ist in
// docs/LANDING_CLAIMS.md einer Feature-ID aus docs/FEATURE_STATUS.md zugeordnet
// und darf erst nach deren Abnahme veröffentlicht werden.

export type SiteLanguage = "de" | "en";

export interface LandingCopy {
  lang: SiteLanguage;
  path: string;
  alternatePath: string;
  alternateLabel: string;
  privacyPath: string;
  meta: { title: string; description: string };
  nav: { features: string; data: string; faq: string; openApp: string; skip: string; main: string };
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    downloadMac: string;
    downloadWindows: string;
    downloadChoose: string;
    tryWeb: string;
    platforms: string;
    returning: string;
    returningAction: string;
  };
  demo: {
    label: string;
    app: string;
    text: string;
    listening: string;
    audio: string;
    refinement: string;
    refinementOff: string;
    caption: string;
  };
  features: { title: string; lead: string; items: { title: string; body: string }[] };
  data: {
    title: string;
    lead: string;
    local: { title: string; points: string[] };
    provider: { title: string; points: string[] };
    note: string;
  };
  cost: { title: string; body: string };
  openSource: { title: string; body: string; github: string; selfHosting: string; security: string };
  requirements: { title: string; items: string[]; unsigned: string; signed: string };
  download: {
    title: string;
    lead: string;
    mac: string;
    macDetail: string;
    windows: string;
    windowsDetail: string;
    checksums: string;
    allReleases: string;
  };
  faq: { title: string; items: { q: string; a: string }[] };
  footer: { tagline: string; privacy: string; legal: string; license: string; source: string };
}

const de: LandingCopy = {
  lang: "de",
  path: "/",
  alternatePath: "/en",
  alternateLabel: "English",
  privacyPath: "/datenschutz",
  meta: {
    title: "Nivune · Kostenloses Diktieren, lokal oder mit deinem KI-Anbieter",
    description:
      "Nivune macht aus gesprochenen Gedanken direkt nutzbaren Text. Open Source, ohne Konto, auf Mac, Windows und im Browser. Lokal auf deinem Gerät oder mit deinem eigenen KI-Anbieter.",
  },
  nav: { features: "Funktionen", data: "Datenfluss", faq: "Fragen", openApp: "Web-App öffnen", skip: "Zum Inhalt springen", main: "Hauptnavigation" },
  hero: {
    eyebrow: "Open Source · kostenlos · ohne Konto",
    title: "Deine Stimme. Deine Modelle. Dein Text.",
    lead:
      "Nivune macht aus gesprochenen Gedanken Text, den du direkt verwenden kannst: in jeder App auf deinem Mac oder Windows-PC, bei längeren Aufnahmen und für vorhandene Audiodateien. Lokal auf deinem Gerät oder mit deinem eigenen KI-Anbieter.",
    downloadMac: "Für macOS laden",
    downloadWindows: "Für Windows laden",
    downloadChoose: "Download wählen",
    tryWeb: "Im Browser ausprobieren",
    platforms: "macOS mit Apple Silicon · Windows 10 und 11 (64 Bit) · Web",
    returning: "Du hast Nivune in diesem Browser schon genutzt. Dein Verlauf und deine Einstellungen liegen jetzt unter /app.",
    returningAction: "Zur Web-App",
  },
  demo: {
    label: "Beispiel: Diktat in einer E-Mail",
    app: "Neue E-Mail",
    text: "Kurze Rückmeldung zum Entwurf: Die Struktur passt gut. Bitte ergänze bis Freitag noch die Zahlen aus dem dritten Quartal, dann gebe ich ihn frei.",
    listening: "Hört zu",
    audio: "Audio: auf diesem Gerät",
    refinement: "Überarbeitung",
    refinementOff: "Überarbeitung: nur lokale Regeln",
    caption: "Vereinfachte Darstellung: Der Text erscheint dort, wo dein Cursor steht.",
  },
  features: {
    title: "Für die Momente, in denen Tippen bremst.",
    lead: "Drei Wege, ein ruhiges Werkzeug. Nivune tritt hinter deinen Text zurück.",
    items: [
      {
        title: "Diktieren, wo du gerade schreibst",
        body: "Ein Tastenkürzel startet die Aufnahme. Der fertige Text landet an deiner Cursor-Position, ob in E-Mail, Chat, Dokument oder Browser. Ohne Einfügefreigabe liegt er sicher in der Zwischenablage.",
      },
      {
        title: "Längere Aufnahmen und Audiodateien",
        body: "Nimm im Arbeitsbereich mit Pause und Fortsetzen auf oder importiere eine vorhandene Audiodatei. Aufnahmen werden laufend lokal gesichert und lassen sich nach einem Absturz wiederherstellen.",
      },
      {
        title: "Text behalten und weiterverwenden",
        body: "Rohtext und Ergebnis bleiben nebeneinander erhalten. Du kannst bearbeiten, suchen und als TXT oder Markdown exportieren. Der Verlauf liegt auf deinem Gerät und ist jederzeit löschbar.",
      },
    ],
  },
  data: {
    title: "Du entscheidest, wohin dein Audio geht.",
    lead: "Transkription und Textüberarbeitung wählst du getrennt. Vor jeder Aufnahme siehst du, welcher Weg aktiv ist.",
    local: {
      title: "Auf diesem Gerät",
      points: [
        "Transkription mit Whisper direkt auf deinem Computer",
        "Einmaliger Modelldownload von Hugging Face, danach auch ohne Internet",
        "Optionale Textüberarbeitung mit Ollama, ebenfalls lokal",
        "Keine API-Kosten. Das Tempo hängt von deinem Gerät ab.",
      ],
    },
    provider: {
      title: "Mit deinem eigenen Anbieter",
      points: [
        "OpenAI, Groq oder ein eigener OpenAI-kompatibler Server",
        "Audio geht direkt von deinem Gerät zum Anbieter, nicht über Nivune",
        "Eigene Modell-IDs und Serveradressen sind möglich",
        "Der Anbieter rechnet seine Nutzung direkt mit dir ab",
      ],
    },
    note: "Nivune wechselt nie still zu einem anderen Anbieter. Ein Weg, der eine Cloud-Stufe enthält, wird nicht als lokal bezeichnet.",
  },
  cost: {
    title: "Was es kostet",
    body: "Nivune selbst kostet nichts: kein Konto, kein Abo, keine Wortlimits. Nutzt du einen Cloud-Anbieter, zahlst du dessen Gebühren direkt dort. Lokal fallen keine API-Kosten an; dafür brauchst du Speicherplatz für das Modell und etwas Rechenleistung.",
  },
  openSource: {
    title: "Offen entwickelt",
    body: "Der Quellcode steht unter der MIT-Lizenz auf GitHub. Du kannst Nivune prüfen, anpassen und die Web-App selbst betreiben. Fehlerberichte, Übersetzungen und neue Anbieteradapter sind willkommen.",
    github: "Quellcode auf GitHub",
    selfHosting: "Selbst betreiben",
    security: "Sicherheitslücke melden",
  },
  requirements: {
    title: "Voraussetzungen",
    items: [
      "macOS 12 oder neuer auf Apple Silicon (M1 und neuer). Intel-Macs werden derzeit nicht unterstützt.",
      "Windows 10 oder 11 in der 64-Bit-Version.",
      "Web-App: aktuelle Versionen von Chrome, Edge oder Safari. Lokale Transkription im Browser ist langsamer als in der Desktop-App.",
      "Lokaler Modus: je nach Modell etwa 85 bis 600 MB Speicherplatz.",
    ],
    unsigned:
      "Die Installer sind noch nicht von Apple notarisiert und unter Windows nicht mit einem Herausgeberzertifikat signiert. Beim ersten Start zeigt dein System deshalb eine Warnung. Prüfsummen findest du bei jeder Veröffentlichung auf GitHub.",
    signed: "Die Installer sind signiert. Prüfsummen findest du bei jeder Veröffentlichung auf GitHub.",
  },
  download: {
    title: "Nivune laden",
    lead: "Kostenlos, ohne Anmeldung. Die Einrichtung führt dich in vier Schritten zum ersten Text.",
    mac: "macOS",
    macDetail: "Apple Silicon · .dmg",
    windows: "Windows",
    windowsDetail: "64 Bit · .exe",
    checksums: "SHA-256-Prüfsummen",
    allReleases: "Alle Versionen und Release-Notizen",
  },
  faq: {
    title: "Häufige Fragen",
    items: [
      {
        q: "Brauche ich einen API-Key?",
        a: "Nein. Im lokalen Modus arbeitet Nivune ohne Key. Für OpenAI oder Groq hinterlegst du deinen eigenen Key; die Desktop-App speichert ihn verschlüsselt über das Betriebssystem.",
      },
      {
        q: "Funktioniert Nivune ohne Internet?",
        a: "Ja, im lokalen Modus nach dem einmaligen Modelldownload. Cloud-Anbieter brauchen eine Internetverbindung.",
      },
      {
        q: "Welche Sprachen versteht Nivune?",
        a: "Die Oberfläche gibt es auf Deutsch und Englisch. Erkannt werden je nach Modell viele weitere Sprachen; am gründlichsten geprüft sind Deutsch und Englisch.",
      },
      {
        q: "Wo landen meine Texte?",
        a: "Verlauf und Einstellungen bleiben auf deinem Gerät beziehungsweise in deinem Browser. Es gibt kein Nivune-Konto und keine Nivune-Cloud. Du kannst den Verlauf jederzeit exportieren oder löschen.",
      },
      {
        q: "Sammelt Nivune Nutzungsdaten?",
        a: "Nein, es gibt keine Telemetrie. Netzwerkanfragen gehen nur an den Anbieter, den du wählst, an Hugging Face für einen Modelldownload, den du startest, und an GitHub, wenn du nach Updates suchst.",
      },
      {
        q: "Wie aktualisiere ich Nivune?",
        a: "In der Desktop-App über „Nach Updates suchen“. Nivune zeigt dir die neue Version und öffnet die offizielle Download-Seite. Installiert wird nie etwas ohne dich.",
      },
      {
        q: "Gibt es Nivune für Linux oder Intel-Macs?",
        a: "Noch nicht als Desktop-App. Die Web-App läuft in aktuellen Browsern auch dort.",
      },
    ],
  },
  footer: {
    tagline: "Nivune ist ein unabhängiges Open-Source-Projekt.",
    privacy: "Datenschutz",
    legal: "Impressum",
    license: "MIT-Lizenz",
    source: "GitHub",
  },
};

const en: LandingCopy = {
  lang: "en",
  path: "/en",
  alternatePath: "/",
  alternateLabel: "Deutsch",
  privacyPath: "/en/privacy",
  meta: {
    title: "Nivune · Free dictation, on your device or with your own AI provider",
    description:
      "Nivune turns spoken thoughts into text you can use right away. Open source, no account, on Mac, Windows, and the web. On your device or with your own AI provider.",
  },
  nav: { features: "Features", data: "Data flow", faq: "FAQ", openApp: "Open web app", skip: "Skip to content", main: "Main navigation" },
  hero: {
    eyebrow: "Open source · free · no account",
    title: "Your voice. Your models. Your text.",
    lead:
      "Nivune turns spoken thoughts into text you can use right away: in any app on your Mac or Windows PC, for longer recordings, and for existing audio files. On your device or with your own AI provider.",
    downloadMac: "Download for macOS",
    downloadWindows: "Download for Windows",
    downloadChoose: "Choose a download",
    tryWeb: "Try it in your browser",
    platforms: "macOS on Apple Silicon · Windows 10 and 11 (64-bit) · Web",
    returning: "You have used Nivune in this browser before. Your history and settings now live at /app.",
    returningAction: "Go to web app",
  },
  demo: {
    label: "Example: dictating an email",
    app: "New email",
    text: "Quick note on the draft: the structure works well. Please add the third-quarter numbers by Friday and I will sign it off.",
    listening: "Listening",
    audio: "Audio: on this device",
    refinement: "Refinement",
    refinementOff: "Refinement: local rules only",
    caption: "Simplified illustration: the text appears wherever your cursor is.",
  },
  features: {
    title: "For the moments when typing slows you down.",
    lead: "Three ways in, one calm tool. Nivune steps back behind your text.",
    items: [
      {
        title: "Dictate wherever you are writing",
        body: "A keyboard shortcut starts recording. The finished text lands at your cursor, whether in email, chat, a document, or the browser. Without paste permission it waits safely on your clipboard.",
      },
      {
        title: "Longer recordings and audio files",
        body: "Record in the workspace with pause and resume, or import an existing audio file. Recordings are saved locally as you go and can be recovered after a crash.",
      },
      {
        title: "Keep and reuse your text",
        body: "The raw transcript and the result stay side by side. Edit, search, and export as TXT or Markdown. Your history stays on your device and can be deleted at any time.",
      },
    ],
  },
  data: {
    title: "You decide where your audio goes.",
    lead: "Choose transcription and text refinement separately. Before every recording you see which path is active.",
    local: {
      title: "On this device",
      points: [
        "Transcription with Whisper directly on your computer",
        "One-time model download from Hugging Face, then works offline",
        "Optional text refinement with Ollama, also local",
        "No API costs. Speed depends on your device.",
      ],
    },
    provider: {
      title: "With your own provider",
      points: [
        "OpenAI, Groq, or your own OpenAI-compatible server",
        "Audio goes straight from your device to the provider, not through Nivune",
        "Custom model IDs and server addresses are supported",
        "The provider bills its usage directly to you",
      ],
    },
    note: "Nivune never silently switches to another provider. A path that includes a cloud step is never labeled local.",
  },
  cost: {
    title: "What it costs",
    body: "Nivune itself is free: no account, no subscription, no word limits. If you use a cloud provider, you pay their fees directly. Running locally has no API costs; you need storage for the model and some processing power instead.",
  },
  openSource: {
    title: "Developed in the open",
    body: "The source code is on GitHub under the MIT license. You can inspect Nivune, adapt it, and host the web app yourself. Bug reports, translations, and new provider adapters are welcome.",
    github: "Source on GitHub",
    selfHosting: "Self-hosting guide",
    security: "Report a vulnerability",
  },
  requirements: {
    title: "Requirements",
    items: [
      "macOS 12 or later on Apple Silicon (M1 and newer). Intel Macs are not supported yet.",
      "Windows 10 or 11, 64-bit.",
      "Web app: current versions of Chrome, Edge, or Safari. Local transcription in the browser is slower than in the desktop app.",
      "Local mode: about 85 to 600 MB of storage, depending on the model.",
    ],
    unsigned:
      "The installers are not yet notarized by Apple or signed with a publisher certificate on Windows, so your system shows a warning on first launch. Checksums are published with every release on GitHub.",
    signed: "The installers are signed. Checksums are published with every release on GitHub.",
  },
  download: {
    title: "Get Nivune",
    lead: "Free, no sign-up. Setup takes you to your first text in four steps.",
    mac: "macOS",
    macDetail: "Apple Silicon · .dmg",
    windows: "Windows",
    windowsDetail: "64-bit · .exe",
    checksums: "SHA-256 checksums",
    allReleases: "All versions and release notes",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        q: "Do I need an API key?",
        a: "No. In local mode Nivune works without a key. For OpenAI or Groq you add your own key; the desktop app stores it encrypted by the operating system.",
      },
      {
        q: "Does Nivune work offline?",
        a: "Yes, in local mode after the one-time model download. Cloud providers need an internet connection.",
      },
      {
        q: "Which languages does Nivune understand?",
        a: "The interface is available in English and German. Depending on the model, many more languages are recognized; English and German are the most thoroughly tested.",
      },
      {
        q: "Where does my text end up?",
        a: "History and settings stay on your device or in your browser. There is no Nivune account and no Nivune cloud. You can export or delete your history at any time.",
      },
      {
        q: "Does Nivune collect usage data?",
        a: "No, there is no telemetry. Network requests only go to the provider you choose, to Hugging Face for a model download you start, and to GitHub when you check for updates.",
      },
      {
        q: "How do I update Nivune?",
        a: "In the desktop app, use “Check for updates”. Nivune shows you the new version and opens the official download page. Nothing is ever installed without you.",
      },
      {
        q: "Is Nivune available for Linux or Intel Macs?",
        a: "Not as a desktop app yet. The web app runs in current browsers there as well.",
      },
    ],
  },
  footer: {
    tagline: "Nivune is an independent open-source project.",
    privacy: "Privacy",
    legal: "Legal notice",
    license: "MIT license",
    source: "GitHub",
  },
};

export const LANDING_COPY: Record<SiteLanguage, LandingCopy> = { de, en };
