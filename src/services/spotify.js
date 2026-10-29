export async function searchSpotify(query, type = "track", offset = 0) {
  const params = new URLSearchParams({
    q: query.trim(),
    type,
    offset: String(offset),
  });

  let response;

  try {
    response = await fetch(`/api/search?${params}`);
  } catch {
    throw new Error("Serveur inaccessible. Vérifie que le backend est démarré.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error || `Erreur du serveur : HTTP ${response.status}`
    );
  }

  if (!data || !Array.isArray(data.items)) {
    throw new Error("Réponse du serveur invalide.");
  }

  return data;
}