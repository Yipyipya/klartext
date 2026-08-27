const RESPONSES_URL = "https://api.openai.com/v1/responses";
const REFINEMENT_MODEL = "gpt-5.4-mini";

const INSTRUCTIONS = `Du überarbeitest ein automatisch erzeugtes Diktat sehr vorsichtig.

Regeln:
- Erhalte Inhalt, Sprache, Ton, Wortwahl, Namen und Fachbegriffe vollständig.
- Korrigiere ausschließlich Interpunktion, Groß- und Kleinschreibung, offensichtliche Grammatikfehler, Füllwörter, unbeabsichtigte Wortwiederholungen und klare Selbstkorrekturen.
- Formuliere keine Aussagen um, fasse nichts zusammen und ergänze keine Informationen.
- Setze Absätze nur bei einem klaren Themenwechsel.
- Gib ausschließlich den fertigen Text zurück, ohne Einleitung, Erklärung oder Anführungszeichen.`;

type ResponsePayload = {
  status?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function readOutputText(payload: ResponsePayload): string {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text!.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function refineTranscriptWithOpenAI(
  text: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  const input = text.trim();
  if (!input || !apiKey.trim()) return input;

  // Lange Dateien nicht auf das Ausgabe-Limit kürzen. Ganze Textabschnitte
  // werden getrennt geglättet; bei einem Fehler behält der Aufrufer das Original.
  if (input.length > 12_000) {
    const parts: string[] = [];
    let rest = input;
    while (rest.length > 12_000) {
      const window = rest.slice(0, 12_000);
      const matches = [...window.matchAll(/[.!?]\s+|\n\n/g)];
      const last = matches.at(-1);
      const boundary = last && last.index! > 6_000
        ? last.index! + last[0].length
        : window.lastIndexOf(" ") > 6_000 ? window.lastIndexOf(" ") : 12_000;
      parts.push(rest.slice(0, boundary));
      rest = rest.slice(boundary);
    }
    parts.push(rest);
    const refined: string[] = [];
    for (const part of parts) refined.push(await refineTranscriptWithOpenAI(part, apiKey, signal));
    return refined.join("\n\n");
  }

  const response = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: REFINEMENT_MODEL,
      instructions: INSTRUCTIONS,
      input,
      reasoning: { effort: "none" },
      text: { verbosity: "low" },
      max_output_tokens: Math.min(16000, Math.max(512, Math.ceil(input.length / 2))),
      store: false,
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`REFINEMENT_${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const payload = (await response.json()) as ResponsePayload;
  if (payload.status !== "completed") throw new Error("REFINEMENT_INCOMPLETE");
  const refined = readOutputText(payload);
  if (!refined) throw new Error("REFINEMENT_EMPTY");
  return refined;
}
