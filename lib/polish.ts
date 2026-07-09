import Anthropic from "@anthropic-ai/sdk";

export const POLISH_MODEL = "claude-opus-4-8";

const SYSTEM = `Du korrigierst Diktat-Transkripte aus einer Spracherkennung.
- Korrigiere falsch erkannte Wörter anhand des Kontexts (z. B. "umslappt" → "ob's klappt").
- Entferne Füllwörter, Versprecher und unbeabsichtigte Wiederholungen.
- Setze sinnvolle Interpunktion, Groß-/Kleinschreibung und Absätze.
- Ändere weder Inhalt noch Ton noch Sprache. Fasse nichts zusammen, lasse nichts weg.
- Antworte AUSSCHLIESSLICH mit dem korrigierten Text, ohne Kommentar oder Einleitung.`;

/**
 * Kontextbasierter Feinschliff über die Claude-API.
 * Der Key kommt vom Nutzer, bleibt auf dem Gerät und geht nur direkt an Anthropic.
 */
export async function polishTranscript(text: string, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.messages.create({
    model: POLISH_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: text }],
  });
  const block = response.content.find((b) => b.type === "text");
  const polished = block && block.type === "text" ? block.text.trim() : "";
  return polished || text;
}
