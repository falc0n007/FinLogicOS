/**
 * Profile store — manages multi-profile support in the UI via localStorage.
 * Each profile gets its own namespace for inputs, scenarios, and journal data.
 */

const PROFILE_KEY = 'finlogic-active-profile';
const PROFILES_KEY = 'finlogic-profiles';

const DEFAULT_PROFILE = {
  id: 'default',
  display_name: 'My Finances',
  created_at: new Date().toISOString(),
  color: '#4F8EF7',
};

export function getActiveProfileId() {
  return localStorage.getItem(PROFILE_KEY) || 'default';
}

export function setActiveProfileId(profileId) {
  localStorage.setItem(PROFILE_KEY, profileId);
}

export function listProfiles() {
  const raw = localStorage.getItem(PROFILES_KEY);
  if (!raw) return [DEFAULT_PROFILE];
  try {
    const profiles = JSON.parse(raw);
    return profiles.length > 0 ? profiles : [DEFAULT_PROFILE];
  } catch {
    return [DEFAULT_PROFILE];
  }
}

export function createProfile(displayName, color = '#4F8EF7') {
  const profiles = listProfiles();
  const id = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  if (profiles.find((p) => p.id === id)) {
    throw new Error(`Profile "${id}" already exists`);
  }

  const profile = {
    id,
    display_name: displayName,
    created_at: new Date().toISOString(),
    color,
  };

  profiles.push(profile);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  return profile;
}

export function deleteProfile(profileId) {
  const profiles = listProfiles();
  if (profiles.length <= 1) {
    throw new Error('Cannot delete the last profile');
  }
  const updated = profiles.filter((p) => p.id !== profileId);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));

  if (getActiveProfileId() === profileId) {
    setActiveProfileId(updated[0].id);
  }
}

/**
 * Returns a namespaced key for profile-scoped storage.
 */
export function profileKey(baseKey) {
  const profileId = getActiveProfileId();
  return `${profileId}-${baseKey}`;
}
