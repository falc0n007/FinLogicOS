import { useState, useRef, useEffect } from 'react';
import {
  listProfiles,
  getActiveProfileId,
  setActiveProfileId,
  createProfile,
} from '../data/profileStore.js';

function ProfileAvatar({ profile, size = 32 }) {
  const initials = profile.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="profile-avatar"
      style={{
        width: size,
        height: size,
        background: profile.color || 'var(--color-accent)',
        fontSize: size * 0.4,
      }}
      title={profile.display_name}
    >
      {initials}
    </div>
  );
}

function IconCheck() {
  return (
    <span className="profile-dropdown-check" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 4L6 11 3 8" />
      </svg>
    </span>
  );
}

function IconPlus() {
  return (
    <span className="profile-dropdown-add-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
    </span>
  );
}

export default function ProfileSwitcher() {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [profiles, setProfiles] = useState(listProfiles());
  const activeId = getActiveProfileId();
  const dropdownRef = useRef(null);

  const activeProfile = profiles.find((p) => p.id === activeId) || profiles[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(profileId) {
    setActiveProfileId(profileId);
    setOpen(false);
    window.location.reload();
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const p = createProfile(newName.trim());
      setProfiles(listProfiles());
      setNewName('');
      setCreating(false);
      handleSelect(p.id);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="profile-switcher" ref={dropdownRef}>
      <button
        type="button"
        className="profile-switcher-trigger"
        onClick={() => setOpen(!open)}
        aria-label="Switch profile"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <ProfileAvatar profile={activeProfile} />
      </button>

      {open && (
        <div className="profile-dropdown">
          <div className="profile-dropdown-header">Profiles</div>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`profile-dropdown-item${p.id === activeId ? ' profile-dropdown-item--active' : ''}`}
              onClick={() => handleSelect(p.id)}
            >
              <ProfileAvatar profile={p} size={24} />
              <span className="profile-dropdown-name">{p.display_name}</span>
              {p.id === activeId && <IconCheck />}
            </button>
          ))}

          {creating ? (
            <form onSubmit={handleCreate} className="profile-create-form">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Profile name"
                autoFocus
                className="profile-create-input"
              />
              <button type="submit" className="profile-create-btn">
                Create
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="profile-dropdown-item profile-dropdown-add"
              onClick={() => setCreating(true)}
            >
              <IconPlus />
              New Profile
            </button>
          )}
        </div>
      )}
    </div>
  );
}
