'use strict';

const { fetchRegistry, loadLocalRegistry, searchRegistry, REGISTRY_CACHE_PATH } = require('../registry-client');

/**
 * Default registry URL. Can be overridden via environment variable.
 */
const DEFAULT_REGISTRY_URL =
  process.env.FINLOGIC_REGISTRY_URL || 'https://registry.finlogicos.dev/registry.json';

/**
 * Registers the `registry` subcommand group onto a Commander program.
 *
 * Subcommands:
 *   registry update              - Download the latest registry.json
 *   registry search <query>      - Search registry by name, tags, or region
 *   registry list                - List all packs in the local registry cache
 *
 * @param {import('commander').Command} program - The root Commander program.
 * @param {object} chalk - chalk instance
 */
function registerRegistryCommand(program, chalk) {
  const registryCmd = program
    .command('registry')
    .description('Manage the FinLogicOS model pack registry');

  // -------------------------------------------------------------------------
  // registry update
  // -------------------------------------------------------------------------
  registryCmd
    .command('update')
    .description('Download the latest registry index and cache it locally')
    .option('--url <url>', 'Override the registry URL', DEFAULT_REGISTRY_URL)
    .action(async (opts) => {
      const url = opts.url || DEFAULT_REGISTRY_URL;
      console.log('');
      console.log(chalk.bold('Updating registry...'));
      console.log(chalk.dim(`  Source: ${url}`));
      console.log('');

      let registry;
      try {
        registry = await fetchRegistry(url);
      } catch (err) {
        console.error(chalk.red(`Failed to update registry: ${err.message}`));
        process.exit(1);
      }

      const packCount = Array.isArray(registry.packs) ? registry.packs.length : 0;
      console.log(chalk.green(`Registry updated. ${packCount} pack(s) available.`));
      console.log(chalk.dim(`  Cached at: ${REGISTRY_CACHE_PATH}`));
      console.log('');
    });

  // -------------------------------------------------------------------------
  // registry search <query>
  // -------------------------------------------------------------------------
  registryCmd
    .command('search <query>')
    .description('Search the local registry by name, tags, or region')
    .action((query) => {
      console.log('');

      let registry;
      try {
        registry = loadLocalRegistry();
      } catch (err) {
        console.error(chalk.red(err.message));
        process.exit(2);
      }

      const results = searchRegistry(query, registry);

      if (results.length === 0) {
        console.log(chalk.yellow(`No packs found matching "${query}".`));
        console.log('');
        return;
      }

      console.log(chalk.bold(`Found ${results.length} pack(s) matching "${query}":`));
      console.log('');

      for (const pack of results) {
        printPackSummary(pack, chalk);
      }
    });

  // -------------------------------------------------------------------------
  // registry list
  // -------------------------------------------------------------------------
  registryCmd
    .command('list')
    .description('List all packs available in the local registry cache')
    .action(() => {
      console.log('');

      let registry;
      try {
        registry = loadLocalRegistry();
      } catch (err) {
        console.error(chalk.red(err.message));
        process.exit(2);
      }

      const packs = Array.isArray(registry.packs) ? registry.packs : [];

      if (packs.length === 0) {
        console.log(chalk.yellow('The registry is empty.'));
        console.log('');
        return;
      }

      console.log(chalk.bold(`${packs.length} pack(s) in registry:`));
      console.log('');

      for (const pack of packs) {
        printPackSummary(pack, chalk);
      }
    });
}

/**
 * Prints a formatted summary of a single registry pack entry.
 *
 * @param {object} pack  - A registry pack entry.
 * @param {object} chalk - chalk instance
 */
function printPackSummary(pack, chalk) {
  const id = chalk.cyan(pack.id || '(unknown)');
  const version = pack.version ? chalk.dim(`v${pack.version}`) : '';
  const name = pack.name ? `  ${pack.name}` : '';

  console.log(`  ${id} ${version}${name}`);

  if (pack.description) {
    console.log(`    ${chalk.dim(pack.description)}`);
  }

  if (Array.isArray(pack.tags) && pack.tags.length > 0) {
    console.log(`    ${chalk.dim('tags:')} ${pack.tags.join(', ')}`);
  }

  if (pack.region) {
    console.log(`    ${chalk.dim('region:')} ${pack.region}`);
  }

  console.log('');
}

module.exports = { registerRegistryCommand };
