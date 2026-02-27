'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');
const { loadLocalRegistry, getPackEntry } = require('../registry-client');
const { hashBuffer } = require('@finlogicos/core');

/**
 * Downloads a URL to a Buffer.
 *
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;

    const req = client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', (err) => reject(new Error(`Network error: ${err.message}`)));
  });
}

/**
 * Extracts a tar.gz buffer into a target directory using the built-in
 * child_process + tar command available on macOS/Linux.
 *
 * @param {Buffer} tarBuffer - The raw tarball bytes.
 * @param {string} destDir   - Destination directory (must exist).
 * @returns {Promise<void>}
 */
function extractTarball(tarBuffer, destDir) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const tar = spawn('tar', ['xz', '-C', destDir]);

    tar.on('error', (err) => reject(new Error(`tar spawn error: ${err.message}`)));
    tar.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar exited with code ${code}`));
      }
    });

    tar.stdin.write(tarBuffer);
    tar.stdin.end();
  });
}

/**
 * Registers the `install` command on a Commander program.
 *
 * Usage: finlogic install <pack-id> [options]
 *
 * Options:
 *   --dir <path>      Install into a custom models directory (default: packages/models)
 *   --skip-verify     Skip SHA-256 integrity check (requires confirmation)
 *   --dry-run         Show what would happen without actually installing
 *
 * @param {import('commander').Command} program - The root Commander program.
 * @param {object} chalk - chalk instance
 */
function registerInstallCommand(program, chalk) {
  program
    .command('install <pack-id>')
    .description('Download and install a model pack from the registry')
    .option('--dir <path>', 'Install into a custom models directory')
    .option('--skip-verify', 'Skip SHA-256 integrity check (use with caution)')
    .option('--dry-run', 'Show what would be installed without making any changes')
    .action(async (packId, opts) => {
      const isDryRun = Boolean(opts.dryRun);
      const skipVerify = Boolean(opts.skipVerify);

      console.log('');
      console.log(chalk.bold(`Installing pack: ${packId}`));
      if (isDryRun) {
        console.log(chalk.yellow('  [dry-run] No files will be written.'));
      }
      console.log('');

      // ---- Step 1: Load registry ----
      let registry;
      try {
        registry = loadLocalRegistry();
      } catch (err) {
        console.error(chalk.red(err.message));
        process.exit(2);
      }

      const entry = getPackEntry(packId, registry);
      if (!entry) {
        console.error(chalk.red(`Pack "${packId}" not found in local registry.`));
        console.error(chalk.dim('  Run "finlogic registry update" to refresh the registry.'));
        process.exit(1);
      }

      if (!entry.tarball_url) {
        console.error(chalk.red(`Registry entry for "${packId}" has no tarball_url.`));
        process.exit(1);
      }

      const modelsDir = opts.dir
        ? path.resolve(opts.dir)
        : path.resolve(__dirname, '../../../../models');

      const installDir = path.join(modelsDir, packId);

      console.log(chalk.dim(`  Pack:     ${entry.name || packId} v${entry.version || '?'}`));
      console.log(chalk.dim(`  Source:   ${entry.tarball_url}`));
      console.log(chalk.dim(`  Install:  ${installDir}`));
      console.log('');

      if (isDryRun) {
        console.log(chalk.bold.green('Dry run complete. Nothing was installed.'));
        console.log('');
        return;
      }

      // ---- Step 2: Confirm skip-verify if requested ----
      if (skipVerify) {
        const inquirer = require('inquirer');
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message:
              chalk.yellow('WARNING: --skip-verify disables integrity checking. Proceed?'),
            default: false,
          },
        ]);
        if (!confirmed) {
          console.log(chalk.dim('Install cancelled.'));
          console.log('');
          process.exit(0);
        }
      }

      // ---- Step 3: Download tarball ----
      console.log('Downloading...');
      let tarBuffer;
      try {
        tarBuffer = await downloadToBuffer(entry.tarball_url);
      } catch (err) {
        console.error(chalk.red(`Download failed: ${err.message}`));
        process.exit(1);
      }
      console.log(chalk.green(`  Downloaded ${tarBuffer.length} bytes.`));

      // ---- Step 4: Verify SHA-256 ----
      if (!skipVerify) {
        if (!entry.tarball_sha256) {
          console.error(chalk.red('Registry entry is missing tarball_sha256. Cannot verify.'));
          process.exit(1);
        }
        const actualHash = hashBuffer(tarBuffer);
        if (actualHash !== entry.tarball_sha256) {
          console.error(chalk.red('Integrity check failed: tarball SHA-256 does not match registry.'));
          console.error(chalk.dim(`  Expected: ${entry.tarball_sha256}`));
          console.error(chalk.dim(`  Got:      ${actualHash}`));
          process.exit(1);
        }
        console.log(chalk.green('  Integrity check passed.'));
      } else {
        console.log(chalk.yellow('  Integrity check skipped.'));
      }

      // ---- Step 5: Extract to models directory ----
      if (fs.existsSync(installDir)) {
        console.log(chalk.yellow(`  Overwriting existing pack at ${installDir}`));
        fs.rmSync(installDir, { recursive: true, force: true });
      }

      fs.mkdirSync(installDir, { recursive: true });

      try {
        await extractTarball(tarBuffer, installDir);
      } catch (err) {
        console.error(chalk.red(`Extraction failed: ${err.message}`));
        fs.rmSync(installDir, { recursive: true, force: true });
        process.exit(1);
      }

      // ---- Step 6: Validate the installed manifest ----
      const { loadModel } = require('@finlogicos/core');
      try {
        loadModel(installDir);
        console.log(chalk.green('  Manifest validated successfully.'));
      } catch (err) {
        console.error(chalk.red(`Installed pack failed validation: ${err.message}`));
        console.error(chalk.dim('  The pack was extracted but may be malformed.'));
        process.exit(1);
      }

      console.log('');
      console.log(chalk.bold.green(`Pack "${packId}" installed successfully.`));
      console.log(chalk.dim(`  Location: ${installDir}`));
      console.log('');
    });
}

module.exports = { registerInstallCommand };
