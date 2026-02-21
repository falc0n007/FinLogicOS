#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const {
  generateManifest,
  generateLogic,
  generateTest,
  generateReadme,
  generatePackageJson,
} = require('./templates');

/** Valid model category options. */
const CATEGORIES = [
  'tax',
  'investment',
  'debt',
  'retirement',
  'budgeting',
  'other',
];

/**
 * Validates that the model name is a non-empty, lowercase kebab-case string
 * suitable for use as a directory name and npm package name.
 *
 * @param {string} value - The raw input value
 * @returns {true|string} true if valid, or an error message string
 */
function validateModelName(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Model name is required.';
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmed)) {
    return 'Model name must be lowercase kebab-case (e.g. "my-tax-model").';
  }
  return true;
}

/**
 * Validates that the author handle is non-empty.
 *
 * @param {string} value - The raw input value
 * @returns {true|string} true if valid, or an error message string
 */
function validateAuthor(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Author handle is required.';
  }
  return true;
}

/**
 * Writes a file to disk and prints a confirmation line.
 *
 * @param {string} filePath    - Absolute path to the target file
 * @param {string} content     - File content to write
 * @param {string} displayName - Short label shown in the success message
 */
function writeFile(filePath, content, displayName) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(chalk.green('  created  ') + displayName);
}

/**
 * Scaffolds the full model directory structure in the current working directory.
 *
 * @param {string} name     - The model name
 * @param {string} category - The model category
 * @param {string} author   - The author handle
 */
function scaffold(name, category, author) {
  const targetDir = path.join(process.cwd(), name);

  if (fs.existsSync(targetDir)) {
    console.error(
      chalk.red('Error: ') +
        'Directory "' +
        name +
        '" already exists in the current location.'
    );
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  console.log('\nScaffolding model into ' + chalk.cyan(targetDir) + '\n');

  writeFile(
    path.join(targetDir, 'manifest.yaml'),
    generateManifest(name, category, author),
    'manifest.yaml'
  );

  writeFile(
    path.join(targetDir, 'logic.js'),
    generateLogic(name),
    'logic.js'
  );

  writeFile(
    path.join(targetDir, 'logic.test.js'),
    generateTest(name),
    'logic.test.js'
  );

  writeFile(
    path.join(targetDir, 'README.md'),
    generateReadme(name, category),
    'README.md'
  );

  writeFile(
    path.join(targetDir, 'package.json'),
    generatePackageJson(name),
    'package.json'
  );

  console.log('\n' + chalk.green('Done.') + ' Model "' + name + '" is ready.\n');
  console.log('Next steps:');
  console.log('  cd ' + name);
  console.log('  npm install');
  console.log('  npm test');
  console.log('');
}

/**
 * Entry point: prompts the user for model metadata and runs the scaffolder.
 */
async function main() {
  console.log('\n' + chalk.cyan('create-finlogic-model') + ' - FinLogicOS model scaffolder\n');

  let answers;
  try {
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Model name (lowercase kebab-case):',
        validate: validateModelName,
        filter: (v) => v.trim(),
      },
      {
        type: 'list',
        name: 'category',
        message: 'Category:',
        choices: CATEGORIES,
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author handle (e.g. @username):',
        validate: validateAuthor,
        filter: (v) => v.trim(),
      },
    ]);
  } catch (err) {
    // Handle Ctrl-C / forced close gracefully
    if (err.isTtyError || err.message === '') {
      console.log('\nAborted.');
      process.exit(0);
    }
    throw err;
  }

  scaffold(answers.name, answers.category, answers.author);
}

main().catch((err) => {
  console.error(chalk.red('Unexpected error: ') + err.message);
  process.exit(1);
});
