'use strict';

const os = require('os');
const path = require('path');
const inquirer = require('inquirer');

/**
 * Returns the shared ProfileManager instance, constructed with the default
 * ~/.finlogicos directory unless overridden by the FINLOGICOS_DIR environment
 * variable (used in tests).
 *
 * @returns {import('@finlogicos/core').ProfileManager}
 */
function getProfileManager() {
  const { ProfileManager } = require('@finlogicos/core');
  const dir = process.env.FINLOGICOS_DIR || path.join(os.homedir(), '.finlogicos');
  return new ProfileManager(dir);
}

/**
 * Pads a string to a fixed column width with trailing spaces.
 *
 * @param {string} str
 * @param {number} len
 * @returns {string}
 */
function pad(str, len) {
  const s = String(str);
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

/**
 * Formats an ISO 8601 timestamp into a short, human-readable local string.
 *
 * @param {string} iso
 * @returns {string}
 */
function formatTimestamp(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

// ---------------------------------------------------------------------------
// profile list
// ---------------------------------------------------------------------------

/**
 * Lists all profiles, highlighting the active one.
 *
 * @param {object} chalk
 */
function profileListCommand(chalk) {
  const pm = getProfileManager();
  const active = pm.getActiveProfile();
  const profiles = pm.listProfiles();

  console.log('');
  console.log(chalk.bold.underline('Profiles'));
  console.log('');

  const colId = Math.max(2, ...profiles.map((p) => p.id.length));
  const colName = Math.max(4, ...profiles.map((p) => p.display_name.length));
  const sep = '  ';

  const header =
    chalk.bold.green('  ' + pad('ID', colId)) +
    sep +
    chalk.bold.green(pad('Name', colName)) +
    sep +
    chalk.bold.green('Created');

  console.log(header);
  console.log(
    chalk.dim(
      '  ' +
        '-'.repeat(colId) +
        sep +
        '-'.repeat(colName) +
        sep +
        '-'.repeat(22)
    )
  );

  for (const p of profiles) {
    const marker = p.id === active.id ? chalk.cyan('* ') : '  ';
    const idCol = p.id === active.id ? chalk.cyan(pad(p.id, colId)) : pad(p.id, colId);
    const nameCol =
      p.id === active.id
        ? chalk.bold.white(pad(p.display_name, colName))
        : chalk.white(pad(p.display_name, colName));
    const dateCol = chalk.dim(formatTimestamp(p.created_at));

    console.log(marker + idCol + sep + nameCol + sep + dateCol);
  }

  console.log('');
  console.log(chalk.dim(`${profiles.length} profile(s). Active: ${active.id}`));
  console.log('');
}

// ---------------------------------------------------------------------------
// profile show
// ---------------------------------------------------------------------------

/**
 * Shows details of the active profile.
 *
 * @param {object} chalk
 */
function profileShowCommand(chalk) {
  const pm = getProfileManager();
  const profile = pm.getActiveProfile();

  console.log('');
  console.log(chalk.bold.underline('Active Profile'));
  console.log('');
  console.log(`  ${chalk.green('ID:')}           ${profile.id}`);
  console.log(`  ${chalk.green('Name:')}         ${profile.display_name}`);
  console.log(`  ${chalk.green('Created:')}      ${formatTimestamp(profile.created_at)}`);
  if (profile.color) {
    console.log(`  ${chalk.green('Color:')}        ${profile.color}`);
  }
  console.log(`  ${chalk.green('Database:')}     ${profile.db_path}`);
  console.log('');
}

// ---------------------------------------------------------------------------
// profile create <name>
// ---------------------------------------------------------------------------

/**
 * Creates a new profile with the given display name.
 *
 * @param {string} name
 * @param {object} opts  - Commander option values (e.g. { color })
 * @param {object} chalk
 */
function profileCreateCommand(name, opts, chalk) {
  const pm = getProfileManager();

  let profile;
  try {
    profile = pm.createProfile(name, { color: opts.color || null });
  } catch (err) {
    console.error(chalk.red(`Failed to create profile: ${err.message}`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold.green(`Profile created: ${profile.id}`));
  console.log(chalk.dim(`  Name:     ${profile.display_name}`));
  console.log(chalk.dim(`  Database: ${profile.db_path}`));
  console.log('');
}

// ---------------------------------------------------------------------------
// profile select <id>
// ---------------------------------------------------------------------------

/**
 * Switches the active profile to the given id.
 *
 * @param {string} profileId
 * @param {object} chalk
 */
function profileSelectCommand(profileId, chalk) {
  const pm = getProfileManager();

  try {
    pm.setActiveProfile(profileId);
  } catch (err) {
    console.error(chalk.red(`Failed to select profile: ${err.message}`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold.green(`Active profile set to: ${profileId}`));
  console.log('');
}

// ---------------------------------------------------------------------------
// profile rename <id> <new-name>
// ---------------------------------------------------------------------------

/**
 * Renames an existing profile.
 *
 * @param {string} profileId
 * @param {string} newName
 * @param {object} chalk
 */
function profileRenameCommand(profileId, newName, chalk) {
  const pm = getProfileManager();

  try {
    pm.renameProfile(profileId, newName);
  } catch (err) {
    console.error(chalk.red(`Failed to rename profile: ${err.message}`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold.green(`Profile "${profileId}" renamed to "${newName}"`));
  console.log('');
}

// ---------------------------------------------------------------------------
// profile delete <id>
// ---------------------------------------------------------------------------

/**
 * Deletes an existing profile after an interactive confirmation prompt.
 *
 * @param {string} profileId
 * @param {object} chalk
 * @returns {Promise<void>}
 */
async function profileDeleteCommand(profileId, chalk) {
  const pm = getProfileManager();

  // Confirm deletion interactively.
  let answer;
  try {
    answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Delete profile "${profileId}" and all its snapshots? This cannot be undone.`,
        default: false,
      },
    ]);
  } catch (err) {
    console.error(chalk.red(`Prompt error: ${err.message}`));
    process.exit(1);
  }

  if (!answer.confirmed) {
    console.log(chalk.yellow('Deletion cancelled.'));
    return;
  }

  try {
    pm.deleteProfile(profileId);
  } catch (err) {
    console.error(chalk.red(`Failed to delete profile: ${err.message}`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold.green(`Profile "${profileId}" deleted.`));
  console.log('');
}

module.exports = {
  profileListCommand,
  profileShowCommand,
  profileCreateCommand,
  profileSelectCommand,
  profileRenameCommand,
  profileDeleteCommand,
};
