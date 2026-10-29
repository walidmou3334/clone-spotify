import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(serverDirectory, "..");

dotenv.config({
  path: path.join(serverDirectory, ".env"),
});

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const MARKET = process.env.SPOTIFY_MARKET || "MA";
const PORT = Number(process.env.PORT || 3001);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Configuration absente : renseigne SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET."
  );
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");

let accessToken = "";
let expiresAt = 0;
let pendingTokenRequest = null;
let blockedUntil = 0;

function httpError(status, message, retryAfter = null) {
  const error = new Error(message);
  error.status = status;
  error.retryAfter = retryAfter;
  return error;
}

function checkSpotifyCooldown() {
  if (Date.now() < blockedUntil) {
    const seconds = Math.ceil((blockedUntil - Date.now()) / 1000);

    throw httpError(
      429,
      `Spotify limite temporairement les requêtes. Réessaie dans ${seconds} secondes.`,
      seconds
    );
  }
}

function handleSpotifyRateLimit(response) {
  const value = Number(response.headers.get("Retry-After"));
  const seconds = Number.isFinite(value) && value > 0 ? value : 30;

  blockedUntil = Date.now() + seconds * 1000;

  throw httpError(
    429,
    `Spotify limite temporairement les requêtes. Réessaie dans ${seconds} secondes.`,
    seconds
  );
}

// Demander un token d’application à Spotify.
async function requestApplicationToken() {
  const credentials = Buffer.from(
    `${CLIENT_ID}:${CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (response.status === 429) {
    handleSpotifyRateLimit(response);
  }

  if (!response.ok) {
    console.error(`Spotify token : HTTP ${response.status}`);

    throw httpError(
      502,
      "Impossible d’obtenir le token Spotify. Vérifie la configuration du serveur."
    );
  }

  const data = await response.json();

  if (!data.access_token || !Number.isFinite(data.expires_in)) {
    throw httpError(502, "Réponse de connexion Spotify inattendue.");
  }

  accessToken = data.access_token;

  // Marge de 60 secondes avant l’expiration réelle.
  expiresAt =
    Date.now() + Math.max(0, data.expires_in - 60) * 1000;

  return accessToken;
}

async function getAccessToken() {
  checkSpotifyCooldown();

  if (accessToken && Date.now() < expiresAt) {
    return accessToken;
  }

  // Plusieurs recherches simultanées partagent la même demande de token.
  if (!pendingTokenRequest) {
    pendingTokenRequest = requestApplicationToken().finally(() => {
      pendingTokenRequest = null;
    });
  }

  return pendingTokenRequest;
}

async function fetchSearchResults(params) {
  let token = await getAccessToken();

  const sendRequest = (currentToken) =>
    fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
      signal: AbortSignal.timeout(15000),
    });

  let response = await sendRequest(token);

  // Une seule nouvelle tentative si Spotify refuse le token.
  if (response.status === 401) {
    if (accessToken === token) {
      accessToken = "";
      expiresAt = 0;
    }

    token = await getAccessToken();
    response = await sendRequest(token);
  }

  if (response.status === 429) {
    handleSpotifyRateLimit(response);
  }

  if (response.status === 403) {
    throw httpError(
      403,
      "Spotify refuse l’accès. Vérifie le Premium du propriétaire et les restrictions de l’application."
    );
  }

  if (!response.ok) {
    console.error(`Spotify search : HTTP ${response.status}`);

    throw httpError(
      response.status === 400 ? 400 : 502,
      response.status === 400
        ? "Spotify a refusé les paramètres de recherche."
        : "La recherche Spotify est momentanément indisponible."
    );
  }

  return response.json();
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/search", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const type = typeof req.query.type === "string" ? req.query.type : "track";
    const offsetText = req.query.offset ?? "0";

    const keys = {
      track: "tracks",
      artist: "artists",
      album: "albums",
    };

    if (!q || q.length > 200) {
      throw httpError(400, "La recherche doit contenir entre 1 et 200 caractères.");
    }

    if (!Object.hasOwn(keys, type)) {
      throw httpError(400, "Type de recherche invalide.");
    }

    if (
      typeof offsetText !== "string" ||
      !/^\d+$/.test(offsetText) ||
      Number(offsetText) > 1000
    ) {
      throw httpError(400, "Pagination invalide.");
    }

    const params = new URLSearchParams({
      q,
      type,
      offset: offsetText,
      limit: "10",
      market: MARKET,
    });

    const data = await fetchSearchResults(params);
    const result = data[keys[type]];

    if (!result || !Array.isArray(result.items)) {
      throw httpError(502, "Réponse de recherche Spotify inattendue.");
    }

    res.set("Cache-Control", "no-store");

    res.json({
      items: result.items.filter(Boolean),
      offset: result.offset,
      limit: result.limit,
      total: result.total,
      hasNext: Boolean(result.next),
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Route API introuvable." });
});

// Après npm run build, Express sert aussi l’interface Vue.
const distDirectory = path.join(projectDirectory, "dist");
const indexFile = path.join(distDirectory, "index.html");

if (existsSync(indexFile)) {
  app.use(express.static(distDirectory));

  app.get("/", (req, res) => {
    res.sendFile(indexFile);
  });
}

app.use((error, req, res, next) => {
  const timeout =
    error.name === "TimeoutError" || error.name === "AbortError";

  const status = error.status || (timeout ? 504 : 502);

  if (error.retryAfter) {
    res.set("Retry-After", String(error.retryAfter));
  }

  res.status(status).json({
    error: error.status
      ? error.message
      : timeout
        ? "Spotify met trop de temps à répondre. Réessaie."
        : "Impossible de contacter Spotify. Vérifie la connexion du serveur.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur démarré : http://127.0.0.1:${PORT}`);
});