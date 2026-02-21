#!/usr/bin/env node
'use strict';

/**
 * FinLogicOS CLI entry point.
 *
 * Defines all top-level commands using Commander.js and delegates
 * execution to the individual command modules in ./commands/.
 *
 * Commands:
 *   finlogic run <model-id>           - Run a model interactively
 *   finlogic list                     - List all available models
 *   finlogic validate <path>          - Validate a model pack at a path
 *   finlogic snapshot save [model-id] - Run a model and save the snapshot
 *   finlogic snapshot list [model-id] - List saved snapshots
 */

const { program } = require('commander');
const chalk = require('chalk');

program
  .name('finlogic')
  .description('FinLogicOS CLI — run, validate, and inspect financial logic models')
  .version('0.1.0');

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
    await snapshotSaveCommand(modelId, chalk);
  });

snapshotCmd
  .command('list [model-id]')
  .description('List saved snapshots, optionally filtered by model id')
  .action((modelId) => {
    const { snapshotListCommand } = require('./commands/snapshot');
    snapshotListCommand(modelId, chalk);
  });

// ---------------------------------------------------------------------------
// Parse and execute
// ---------------------------------------------------------------------------
program.parse(process.argv);
