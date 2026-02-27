#!/usr/bin/env node
'use strict';

/**
 * FinLogicOS CLI entry point.
 *
 * Defines all top-level commands using Commander.js and delegates
 * execution to the individual command modules in ./commands/.
 *
 * Commands:
 *   finlogic run <model-id>                 - Run a model interactively
 *   finlogic list                           - List all available models
 *   finlogic validate <path>                - Validate a model pack at a path
 *   finlogic snapshot save [model-id]       - Run a model and save the snapshot
 *   finlogic snapshot list [model-id]       - List saved snapshots
 *   finlogic profile list                   - List all profiles
 *   finlogic profile show                   - Show active profile details
 *   finlogic profile create <name>          - Create a new profile
 *   finlogic profile select <id>            - Switch active profile
 *   finlogic profile rename <id> <new-name> - Rename a profile
 *   finlogic profile delete <id>            - Delete a profile
 *
 * Global options:
 *   --profile <id>   Override the active profile for this invocation
 */

const os = require('os');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');

// ---------------------------------------------------------------------------
// Global option: --profile <id>
// ---------------------------------------------------------------------------

program
  .name('finlogic')
  .description('FinLogicOS CLI — run, validate, and inspect financial logic models')
  .version('0.1.0')
  .option('--profile <id>', 'override the active profile for this invocation');

/**
 * Resolves the db path to use for snapshot/journal operations. Respects the
 * --profile global option; falls back to the active profile from ProfileManager.
 *
 * @returns {string}
 */
function resolveDbPath() {
  const { ProfileManager } = require('@finlogicos/core');
  const dir = process.env.FINLOGICOS_DIR || path.join(os.homedir(), '.finlogicos');
  const pm = new ProfileManager(dir);

  const profileId = program.opts().profile;
  if (profileId) {
    const profiles = pm.listProfiles();
    const found = profiles.find((p) => p.id === profileId);
    if (!found) {
      console.error(chalk.red(`Profile "${profileId}" not found. Run "finlogic profile list" to see available profiles.`));
      process.exit(1);
    }
    return found.db_path;
  }

  return pm.getActiveProfile().db_path;
}

// ---------------------------------------------------------------------------
// finlogic run <model-id>
// ---------------------------------------------------------------------------
program
  .command('run <model-id>')
  .description('Load a model, prompt for inputs, and display results')
  .option(
    '-i, --input <key=value>',
    'supply an input value without prompting (repeatable)',
    (val, acc) => {
      acc.push(val);
      return acc;
    },
    []
  )
  .action(async (modelId, opts) => {
    const { runCommand } = require('./commands/run');
    await runCommand(modelId, opts, chalk);
  });

// ---------------------------------------------------------------------------
// finlogic list
// ---------------------------------------------------------------------------
program
  .command('list')
  .description('List all available models in the models directory')
  .action(() => {
    const { listCommand } = require('./commands/list');
    listCommand(chalk);
  });

// ---------------------------------------------------------------------------
// finlogic validate <path>
// ---------------------------------------------------------------------------
program
  .command('validate <path>')
  .description('Validate a model pack: check manifest, logic, and attempt a dry run')
  .action((modelPath) => {
    const { validateCommand } = require('./commands/validate');
    validateCommand(modelPath, chalk);
  });

// ---------------------------------------------------------------------------
// finlogic snapshot
// ---------------------------------------------------------------------------
const snapshotCmd = program
  .command('snapshot')
  .description('Manage execution snapshots');

snapshotCmd
  .command('save [model-id]')
  .description('Run a model and save the results as a snapshot')
  .action(async (modelId) => {
    const { snapshotSaveCommand } = require('./commands/snapshot');
    await snapshotSaveCommand(modelId, chalk, resolveDbPath());
  });

snapshotCmd
  .command('list [model-id]')
  .description('List saved snapshots, optionally filtered by model id')
  .action((modelId) => {
    const { snapshotListCommand } = require('./commands/snapshot');
    snapshotListCommand(modelId, chalk, resolveDbPath());
  });

// ---------------------------------------------------------------------------
// finlogic profile
// ---------------------------------------------------------------------------
const profileCmd = program
  .command('profile')
  .description('Manage user profiles (each profile has its own snapshot database)');

profileCmd
  .command('list')
  .description('List all profiles')
  .action(() => {
    const { profileListCommand } = require('./commands/profile');
    profileListCommand(chalk);
  });

profileCmd
  .command('show')
  .description('Show the currently active profile')
  .action(() => {
    const { profileShowCommand } = require('./commands/profile');
    profileShowCommand(chalk);
  });

profileCmd
  .command('create <name>')
  .description('Create a new profile')
  .option('--color <hex>', 'optional color tag for the profile')
  .action((name, opts) => {
    const { profileCreateCommand } = require('./commands/profile');
    profileCreateCommand(name, opts, chalk);
  });

profileCmd
  .command('select <id>')
  .description('Switch the active profile')
  .action((id) => {
    const { profileSelectCommand } = require('./commands/profile');
    profileSelectCommand(id, chalk);
  });

profileCmd
  .command('rename <id> <new-name>')
  .description('Rename a profile')
  .action((id, newName) => {
    const { profileRenameCommand } = require('./commands/profile');
    profileRenameCommand(id, newName, chalk);
  });

profileCmd
  .command('delete <id>')
  .description('Delete a profile and its snapshot database')
  .action(async (id) => {
    const { profileDeleteCommand } = require('./commands/profile');
    await profileDeleteCommand(id, chalk);
  });

// ---------------------------------------------------------------------------
// finlogic journal
// ---------------------------------------------------------------------------
const journalCmd = program
  .command('journal')
  .description('Manage your financial decision journal');

journalCmd
  .command('list')
  .description('List journal entries')
  .option('--category <cat>', 'filter by category')
  .option('--year <year>', 'filter by year')
  .action((opts) => {
    const { journalListCommand } = require('./commands/journal');
    const mergedOpts = { ...opts, profile: program.opts().profile };
    journalListCommand(mergedOpts, chalk);
  });

journalCmd
  .command('add')
  .description('Add a new journal entry interactively')
  .action(async () => {
    const { journalAddCommand } = require('./commands/journal');
    await journalAddCommand(chalk);
  });

journalCmd
  .command('show <id>')
  .description('Show a journal entry')
  .action((id) => {
    const { journalShowCommand } = require('./commands/journal');
    journalShowCommand(id, chalk);
  });

journalCmd
  .command('health')
  .description('Show Decision Health metric')
  .option('--year <year>', 'filter by year')
  .action((opts) => {
    const { journalHealthCommand } = require('./commands/journal');
    const mergedOpts = { ...opts, profile: program.opts().profile };
    journalHealthCommand(mergedOpts, chalk);
  });

journalCmd
  .command('export')
  .description('Export journal entries for a year as Markdown')
  .option('--year <year>', 'year to export')
  .option('--output <path>', 'output file path')
  .action((opts) => {
    const { journalExportCommand } = require('./commands/journal');
    const mergedOpts = { ...opts, profile: program.opts().profile };
    journalExportCommand(mergedOpts, chalk);
  });

// ---------------------------------------------------------------------------
// finlogic registry
// ---------------------------------------------------------------------------
const { registerRegistryCommand } = require('./commands/registry');
registerRegistryCommand(program, chalk);

// ---------------------------------------------------------------------------
// finlogic install <pack-id>
// ---------------------------------------------------------------------------
const { registerInstallCommand } = require('./commands/install');
registerInstallCommand(program, chalk);

// ---------------------------------------------------------------------------
// finlogic verify [pack-id]
// ---------------------------------------------------------------------------
const { registerVerifyCommand } = require('./commands/verify');
registerVerifyCommand(program, chalk);

// ---------------------------------------------------------------------------
// Parse and execute
// ---------------------------------------------------------------------------
program.parse(process.argv);
