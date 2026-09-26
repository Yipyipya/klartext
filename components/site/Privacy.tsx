import "./landing.css";
import { SiteFooter, SiteHeader } from "./Landing";
import type { SiteLanguage } from "./landing-content";
import { LEGAL_NOTICE_URL } from "@/shared/site";

// Sachliche Beschreibung der tatsächlichen Datenflüsse. Rechtliche Prüfung und
// Angaben zum Verantwortlichen sind Teil der Launch-Freigabe (docs/RELEASE_1.0_CHECKLIST.md).
const UPDATED = { de: "Stand: 23. September 2026", en: "Last updated: September 23, 2026" };

export default function Privacy({ lang }: { lang: SiteLanguage }) {
  const de = lang === "de";
  return (
    <div className="site">
      <SiteHeader lang={lang} />
      <main id="content" className="site-legal">
        <div className="site-container">
          <article>
            <h1>{de ? "Datenschutz" : "Privacy"}</h1>
            <p className="site-updated">{UPDATED[lang]}</p>

            <h2>{de ? "Kurz gesagt" : "In short"}</h2>
            <p>{de
              ? "Nivune hat kein Konto, keine eigene Cloud für deine Aufnahmen und keine Telemetrie. Diese Website setzt keine Cookies und bindet keine Tracking- oder Analysedienste ein."
              : "Nivune has no account, no cloud of its own for your recordings, and no telemetry. This website sets no cookies and uses no tracking or analytics services."}</p>

            <h2>{de ? "Verantwortlicher" : "Controller"}</h2>
            <p>{LEGAL_NOTICE_URL
              ? <>{de ? "Verantwortlich ist der im " : "The controller is the operator named in the "}<a href={LEGAL_NOTICE_URL}>{de ? "Impressum" : "legal notice"}</a>{de ? " genannte Betreiber dieser Website." : " of this website."}</>
              : de ? "Die Angaben zum Verantwortlichen werden mit dem Impressum veröffentlicht." : "Details of the controller are published together with the legal notice."}</p>

            <h2>{de ? "Aufruf dieser Website" : "Visiting this website"}</h2>
            <p>{de
              ? "Die Website wird bei Vercel Inc. gehostet. Beim Aufruf verarbeitet der Hoster technisch notwendige Verbindungsdaten wie IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browserkennung, um die Seite auszuliefern und vor Missbrauch zu schützen. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO). Schriftarten werden von dieser Website selbst ausgeliefert."
              : "The website is hosted by Vercel Inc. When you visit it, the host processes technically necessary connection data such as IP address, time, requested address, and browser identifier to deliver the page and protect it against abuse. The legal basis is our legitimate interest in secure delivery (Art. 6(1)(f) GDPR). Fonts are served by this website itself."}</p>

            <h2>{de ? "Web-App" : "Web app"}</h2>
            <ul>
              <li>{de
                ? "Einstellungen, Verlauf und heruntergeladene lokale Modelle speichert dein Browser auf deinem Gerät. Wir erhalten diese Daten nicht."
                : "Your browser stores settings, history, and downloaded local models on your device. We do not receive this data."}</li>
              <li>{de
                ? "API-Keys gelten standardmäßig nur für die aktuelle Browsersitzung. Nur wenn du „API-Keys auf diesem Gerät merken“ einschaltest, bleiben sie im Browserspeicher."
                : "By default, API keys last only for the current browser session. They stay in browser storage only if you turn on “Remember API keys on this device”."}</li>
              <li>{de
                ? "Im lokalen Modus bleibt dein Audio im Browser. Für den einmaligen Modelldownload baut dein Browser eine Verbindung zu Hugging Face auf."
                : "In local mode your audio stays in the browser. For the one-time model download your browser connects to Hugging Face."}</li>
              <li>{de
                ? "Wählst du einen Cloud-Anbieter (OpenAI, Groq oder einen eigenen Server), sendet dein Browser Audio beziehungsweise Text direkt dorthin. Es gelten die Bedingungen dieses Anbieters. Die Übertragung läuft nicht über uns."
                : "If you choose a cloud provider (OpenAI, Groq, or your own server), your browser sends audio or text directly to it. That provider's terms apply. The transfer does not pass through us."}</li>
            </ul>

            <h2>{de ? "Desktop-App" : "Desktop app"}</h2>
            <ul>
              <li>{de
                ? "Aufnahmen, Verlauf und Einstellungen liegen in deinem Benutzerprofil. API-Keys werden über die Verschlüsselung des Betriebssystems gespeichert."
                : "Recordings, history, and settings live in your user profile. API keys are stored using the operating system's encryption."}</li>
              <li>{de
                ? "Netzwerkanfragen gehen nur an den von dir gewählten Anbieter, an Hugging Face für einen Modelldownload, den du startest, und an GitHub, wenn du nach Updates suchst oder einen Download öffnest."
                : "Network requests only go to the provider you choose, to Hugging Face for a model download you start, and to GitHub when you check for updates or open a download."}</li>
            </ul>

            <h2>{de ? "Downloads über GitHub" : "Downloads from GitHub"}</h2>
            <p>{de
              ? "Installer und Quellcode liegen bei GitHub. Beim Herunterladen gelten die Datenschutzbestimmungen von GitHub."
              : "Installers and source code are hosted on GitHub. GitHub's privacy terms apply when you download."}</p>

            <h2>{de ? "Deine Rechte" : "Your rights"}</h2>
            <p>{de
              ? "Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren. Da wir keine Inhalte aus Nivune erhalten, kannst du lokale Daten jederzeit selbst in der App exportieren oder löschen."
              : "You have the right to access, rectification, erasure, restriction of processing, data portability, and objection, as well as the right to lodge a complaint with a data protection authority. Since we receive no content from Nivune, you can export or delete local data yourself in the app at any time."}</p>
          </article>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
