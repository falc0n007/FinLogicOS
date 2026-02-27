'use strict';

const fs = require('fs');
const path = require('path');
const { verifyPack } = require('@finlogicos/core');
const { loadLocalRegistry, getPackEntry } = require('../registry-client');

/**
 * Registers the `verify` command on a Commander program.
 *
 * Usage: finlogic verify [pack-id]
 *
 * Verifies one or all installed model packs against registry SHA-256 hashes.
 *
 * Exit codes:
 *   0 - All verified packs passed
 *   1 - One or more packs failed verification
 *   2 - No local registry available
 *
 * @param {import('commander').Command} program - The root Commander program.
 * @param {object} chalk - chalk instance
 */
function registerVerifyCommand(program, chalk) {
  program
    .command('verify [pack-id]')
    .description(
      'Verify one or all installed model packs against registry SHA-256 hashes'
    )
    .option(
      '--dir <path>',
      'Directory containing installed model packs (default: packages/models)'
    )
    .action((packId, opts) => {
      console.log('');

      // ---- Load local registry ----
      let registry;
      try {
        registry = loadLocalRegistry();
      } catch (err) {
        console.error(chalk.red(err.message));
        process.exit(2);
      }

      const modelsDir = opts.dir
        ? path.resolve(opts.dir)
        : path.resolve(__dirname, '../../../../models');

      if (!fs.existsSync(modelsDir)) {
        console.error(chalk.red(`Models directory not found: ${modelsDir}`));
        process.exit(1);
      }

      // ---- Determine which packs to verify ----
      let packIds;
      if (packId) {
        packIds = [packId];
      } else {
        // Verify all directories inside modelsDir
        try {
          packIds = fs
            .readdirSync(modelsDir)
            .filter((name) => {
              const fullPath = path.join(modelsDir, name);
              return fs.statSync(fullPath).isDirectory();
            });
        } catch (err) {
          console.error(chalk.red(`Failed to list models directory: ${err.message}`));
          process.exit(1);
        }
      }

      if (packIds.length === 0) {
        console.log(chalk.yellow('No installed model packs found.'));
        console.log('');
        process.exit(0);
      }

      console.log(chalk.bold(`Verifying ${packIds.length} pack(s)...`));
      console.log('');

      let failCount = 0;
      let passCount = 0;
      let unknownCount = 0;

      for (const id of packIds) {
        const modelDir = path.join(modelsDir, id);

        if (!fs.existsSync(modelDir)) {
          console.error(chalk.red(`  [error] Pack directory not found: ${modelDir}`));
          failCount++;
          continue;
        }

        const entry = getPackEntry(id, registry);
        const result = verifyPack(modelDir, entry);

        if (result.valid === null) {
          console.log(chalk.yellow(`  [unknown] ${id} — not in registry`));
          unknownCount++;
        } else if (result.valid) {
          console.log(chalk.green(`  [pass]    ${id}`));
          passCount++;
        } else {
          console.log(chalk.red(`  [fail]    ${id}`));
          for (const e of result.errors) {
            console.log(chalk.red(`              ${e}`));
          }
          failCount++;
        }
      }

      console.log('');
      console.log(
        `Summary: ${chalk.green(`${passCount} passed`)}, ` +
          `${chalk.red(`${failCount} failed`)}, ` +
          `${chalk.yellow(`${unknownCount} unknown`)}`
      );
      console.log('');

      if (failCount > 0) {
        process.exit(1);
      }

      process.exit(0);
    });
}

module.exports = { registerVerifyCommand };
