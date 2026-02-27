'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

function getDbPath() {
  return path.join(os.homedir(), '.finlogicos', 'snapshots.db');
}

function getStore() {
  const { SnapshotStore, JournalStore } = require('@finlogicos/core');
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const store = new SnapshotStore(dbPath);
  const journal = new JournalStore(store._db);
  return { store, journal };
}

async function journalAddCommand(chalk) {
  const inquirer = require('inquirer');
  const { DECISION_CATEGORIES } = require('@finlogicos/core');
  const { journal } = getStore();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Decision title:',
      validate: (v) => (v.trim() ? true : 'Title is required'),
    },
    {
      type: 'list',
      name: 'category',
      message: 'Category:',
      choices: DECISION_CATEGORIES,
    },
    {
      type: 'input',
      name: 'entry_date',
      message: 'Date (YYYY-MM-DD):',
      default: new Date().toISOString().slice(0, 10),
    },
    {
      type: 'input',
      name: 'amount',
      message: 'Amount (optional, press Enter to skip):',
      filter: (v) => (v.trim() === '' ? null : parseFloat(v)),
    },
    {
      type: 'editor',
      name: 'notes',
      message: 'Notes (why did you make this decision?):',
    },
  ]);

  const id = journal.save({
    title: answers.title,
    category: answers.category,
    entry_date: answers.entry_date,
    amount: answers.amount,
    notes: answers.notes ? answers.notes.trim() : null,
  });

  console.log(chalk.green(`\n  [OK] Journal entry #${id} saved.\n`));
}

function journalListCommand(opts, chalk) {
  const { journal } = getStore();
  const profileId = opts.profile || 'default';
  const filters = {};
  if (opts.category) filters.category = opts.category;
  if (opts.year) {
    filters.dateFrom = `${opts.year}-01-01`;
    filters.dateTo = `${opts.year}-12-31`;
  }

  const entries = journal.list(profileId, filters);

  if (entries.length === 0) {
    console.log(chalk.dim('\n  No journal entries found.\n'));
    return;
  }

  console.log('');
  console.log(
    chalk.bold(
      `  ${'ID'.padEnd(6)} ${'DATE'.padEnd(12)} ${'CATEGORY'.padEnd(16)} ${'TITLE'.padEnd(30)} ${'AMOUNT'.padEnd(12)} MODEL`
    )
  );
  console.log(chalk.dim('  ' + '-'.repeat(90)));

  for (const e of entries) {
    const amt = e.amount !== null ? `$${e.amount.toLocaleString('en-US')}` : '';
    const model = e.snapshot_id !== null ? '#' + e.snapshot_id : '-';
    console.log(
      `  ${String(e.id).padEnd(6)} ${e.entry_date.padEnd(12)} ${e.category.padEnd(16)} ${e.title.slice(0, 28).padEnd(30)} ${amt.padEnd(12)} ${model}`
    );
  }
  console.log('');
}

function journalShowCommand(id, chalk) {
  const { journal } = getStore();
  const entry = journal.getById(parseInt(id, 10));

  if (!entry) {
    console.log(chalk.red(`\n  Entry #${id} not found.\n`));
    return;
  }

  console.log('');
  console.log(chalk.bold(`  Journal Entry #${entry.id}`));
  console.log(chalk.dim('  ' + '-'.repeat(40)));
  console.log(`  Date:     ${entry.entry_date}`);
  console.log(`  Category: ${entry.category}`);
  console.log(`  Title:    ${entry.title}`);
  if (entry.amount !== null) {
    console.log(`  Amount:   $${entry.amount.toLocaleString('en-US')} ${entry.amount_currency}`);
  }
  if (entry.snapshot_id !== null) {
    console.log(`  Model:    snapshot #${entry.snapshot_id}`);
  }
  if (entry.tags.length > 0) {
    console.log(`  Tags:     ${entry.tags.join(', ')}`);
  }
  if (entry.notes) {
    console.log(`\n  Notes:\n  ${entry.notes.replace(/\n/g, '\n  ')}`);
  }
  if (entry.outcome) {
    console.log(`\n  Outcome:\n  ${entry.outcome.replace(/\n/g, '\n  ')}`);
  }
  console.log('');
}

function journalHealthCommand(opts, chalk) {
  const { journal } = getStore();
  const profileId = opts.profile || 'default';
  let dateFrom, dateTo;
  if (opts.year) {
    dateFrom = `${opts.year}-01-01`;
    dateTo = `${opts.year}-12-31`;
  }

  const health = journal.decisionHealth(profileId, dateFrom, dateTo);

  const label =
    health.score_pct >= 80
      ? 'Evidence-based'
      : health.score_pct >= 60
        ? 'Mostly tracked'
        : health.score_pct >= 40
          ? 'Partially tracked'
          : 'Untracked';

  console.log('');
  console.log(chalk.bold('  Decision Health Report'));
  console.log(chalk.dim('  ' + '-'.repeat(40)));
  console.log(`  Score:           ${chalk.bold(health.score_pct + '%')} (${label})`);
  console.log(`  Total decisions: ${health.total_decisions}`);
  console.log(`  With evidence:   ${health.decisions_with_model_evidence}`);
  console.log(`  Without:         ${health.decisions_without_model_evidence}`);

  if (Object.keys(health.by_category).length > 0) {
    console.log('');
    console.log(chalk.bold('  By Category:'));
    for (const [cat, info] of Object.entries(health.by_category)) {
      console.log(`    ${cat.padEnd(18)} ${info.with_evidence}/${info.total} (${info.score_pct}%)`);
    }
  }
  console.log('');
}

function journalExportCommand(opts, chalk) {
  const { journal } = getStore();
  const profileId = opts.profile || 'default';
  const year = parseInt(opts.year || new Date().getFullYear(), 10);
  const output = opts.output || `finlogic-decisions-${year}.md`;

  const md = journal.exportYearMarkdown(profileId, year);
  fs.writeFileSync(output, md, 'utf8');
  console.log(chalk.green(`\n  [OK] Exported to ${output}\n`));
}

module.exports = {
  journalAddCommand,
  journalListCommand,
  journalShowCommand,
  journalHealthCommand,
  journalExportCommand,
};
