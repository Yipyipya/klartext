const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadWithEnv(env, modules) {
  const previous = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try {
    for (const file of ["shared/site.ts", ...modules]) delete require.cache[require.resolve(path.join(root, file))];
    return modules.map((file) => require(path.join(root, file)));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("ohne finale Adresse bleibt die Website noindex und ohne Sitemap", () => {
  const [site, sitemap, robots] = loadWithEnv({ NEXT_PUBLIC_SITE_URL: undefined }, ["shared/site.ts", "app/sitemap.ts", "app/robots.ts"]);
  assert.equal(site.SITE_INDEXABLE, false);
  assert.equal(site.MARKETING_ROBOTS.index, false);
  assert.deepEqual(sitemap.default(), []);
  assert.equal(robots.default().sitemap, undefined);
});

test("nur eine sichere HTTPS-Adresse schaltet Indexierung und Sitemap frei", () => {
  const [unsafe] = loadWithEnv({ NEXT_PUBLIC_SITE_URL: "http://nivune.example" }, ["shared/site.ts"]);
  assert.equal(unsafe.SITE_INDEXABLE, false);
  const [site, sitemap, robots] = loadWithEnv({ NEXT_PUBLIC_SITE_URL: "https://nivune.example/" }, ["shared/site.ts", "app/sitemap.ts", "app/robots.ts"]);
  assert.equal(site.SITE_URL, "https://nivune.example");
  assert.equal(site.MARKETING_ROBOTS.index, true);
  const urls = sitemap.default().map((entry) => entry.url);
  assert.deepEqual(urls, ["https://nivune.example", "https://nivune.example/en", "https://nivune.example/datenschutz", "https://nivune.example/en/privacy"]);
  assert.equal(urls.some((url) => url.includes("/app")), false, "der Arbeitsbereich gehört nie in die Sitemap");
  assert.equal(robots.default().sitemap, "https://nivune.example/sitemap.xml");
});

test("Arbeitsbereich unter /app ist immer noindex und das Manifest startet dort", () => {
  assert.match(read("app/(de)/app/layout.tsx"), /robots: NOINDEX_ROBOTS/);
  const manifest = read("app/manifest.ts");
  assert.match(manifest, /id: "\/"/);
  assert.match(manifest, /start_url: "\/app"/);
  assert.equal(fs.existsSync(path.join(root, "app/(de)/page.tsx")), true);
  assert.equal(fs.existsSync(path.join(root, "app/(en)/en/page.tsx")), true);
});

test("Website-Texte enthalten keine Gedankenstriche und DE/EN sind gleich aufgebaut", () => {
  const { LANDING_COPY } = require(path.join(root, "components/site/landing-content.ts"));
  const shape = (value) => Array.isArray(value) ? value.map(shape) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shape(entry)])) : typeof value;
  assert.deepEqual(shape(LANDING_COPY.de), shape(LANDING_COPY.en));
  const texts = JSON.stringify(LANDING_COPY) + read("components/site/Privacy.tsx");
  assert.doesNotMatch(texts, /—/, "keine Em-Dashes in öffentlichen Texten");
});
