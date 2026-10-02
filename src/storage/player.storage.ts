export interface PlayerIdentity {
  id: string;
  displayName: string;
}

const KEY = 'cannon-riot:player';

function createDefault(): PlayerIdentity {
  return {
    id: crypto.randomUUID(),
    displayName: 'Captain',
  };
}

export function loadPlayerIdentity(): PlayerIdentity {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<PlayerIdentity> | null;
    if (parsed?.id && typeof parsed.displayName === 'string') {
      return { id: parsed.id, displayName: parsed.displayName.slice(0, 24) };
    }
  } catch {
    // Fall through to a new persistent local identity.
  }
  const identity = createDefault();
  localStorage.setItem(KEY, JSON.stringify(identity));
  return identity;
}

export function savePlayerIdentity(identity: PlayerIdentity): void {
  localStorage.setItem(KEY, JSON.stringify({
    id: identity.id,
    displayName: identity.displayName.trim().slice(0, 24),
  }));
}
