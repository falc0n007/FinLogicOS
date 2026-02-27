'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const FINLOGIC_DIR = path.join(os.homedir(), '.finlogicos');
const REGISTRY_CACHE_PATH = path.join(FINLOGIC_DIR, 'registry.json');

/**
 * Ensures ~/.finlogicos directory exists.
 */
function ensureFinlogicDir() {
  if (!fs.existsSync(FINLOGIC_DIR)) {
    fs.mkdirSync(FINLOGIC_DIR, { recursive: true });
  }
}

/**
 * Downloads the registry JSON from a URL and caches it at
 * ~/.finlogicos/registry.json.
 *
 * @param {string} registryUrl - URL of the registry.json file to download.
 * @returns {Promise<object>} The parsed registry object.
 */
function fetchRegistry(registryUrl) {
  return new Promise((resolve, reject) => {
    const client = registryUrl.startsWith('https://') ? https : http;

    const req = client.get(registryUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch registry: HTTP ${res.statusCode}`));
        res.resume();
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let registry;
        try {
          registry = JSON.parse(raw);
        } catch (err) {
          reject(new Error(`Registry JSON is invalid: ${err.message}`));
          return;
        }

        try {
          ensureFinlogicDir();
          fs.writeFileSync(REGISTRY_CACHE_PATH, raw, 'utf8');
        } catch (err) {
          reject(new Error(`Failed to cache registry: ${err.message}`));
          return;
        }

        resolve(registry);
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Network error fetching registry: ${err.message}`));
    });
  });
}

/**
 * Reads the locally cached registry.json from ~/.finlogicos/registry.json.
 *
 * @returns {object} The parsed registry object.
 * @throws {Error} If the cache file does not exist or cannot be parsed.
 */
function loadLocalRegistry() {
  if (!fs.existsSync(REGISTRY_CACHE_PATH)) {
    throw new Error(
      `No local registry found at ${REGISTRY_CACHE_PATH}. Run "finlogic registry update" first.`
    );
  }

  let raw;
  try {
    raw = fs.readFileSync(REGISTRY_CACHE_PATH, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read registry cache: ${err.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Registry cache is corrupted (invalid JSON): ${err.message}`);
  }
}

/**
 * Searches the registry for packs matching a query string.
 * Matches against pack id, name, description, tags, and region fields.
 *
 * @param {string} query    - The search string (case-insensitive).
 * @param {object} registry - The registry object (must have a .packs array).
 * @returns {object[]} Array of matching registry entries.
 */
function searchRegistry(query, registry) {
  const packs = Array.isArray(registry.packs) ? registry.packs : [];
  const lower = query.toLowerCase();

  return packs.filter((pack) => {
    if (pack.id && pack.id.toLowerCase().includes(lower)) return true;
    if (pack.name && pack.name.toLowerCase().includes(lower)) return true;
    if (pack.description && pack.description.toLowerCase().includes(lower)) return true;
    if (pack.region && pack.region.toLowerCase().includes(lower)) return true;
    if (Array.isArray(pack.tags)) {
      if (pack.tags.some((tag) => tag.toLowerCase().includes(lower))) return true;
    }
    return false;
  });
}

/**
 * Looks up a single pack entry by its id.
 *
 * @param {string} packId   - The exact pack id to find.
 * @param {object} registry - The registry object (must have a .packs array).
 * @returns {object|null} The registry entry, or null if not found.
 */
function getPackEntry(packId, registry) {
  const packs = Array.isArray(registry.packs) ? registry.packs : [];
  return packs.find((p) => p.id === packId) || null;
}

module.exports = {
  fetchRegistry,
  loadLocalRegistry,
  searchRegistry,
  getPackEntry,
  REGISTRY_CACHE_PATH,
};
