#!/usr/bin/env node

/**
 * Setup script to copy config.cjs.example to config.cjs
 * This helps users quickly set up their private configuration file
 */

const fs = require('fs');
const path = require('path');

const exampleConfigPath = path.join(__dirname, 'config.cjs.example');
const configPath = path.join(__dirname, 'config.cjs');

function setupConfig() {
  // Check if config.cjs already exists
  if (fs.existsSync(configPath)) {
    console.log('✓ config.cjs already exists. No action needed.');
    console.log('  If you need to update it, please edit config.cjs directly or');
    console.log('  delete it and run this script again to copy from the example.');
    return;
  }

  // Check if example file exists
  if (!fs.existsSync(exampleConfigPath)) {
    console.error('✗ Error: config.cjs.example not found!');
    console.error('  This file should exist in the repository.');
    process.exit(1);
  }

  try {
    // Copy example to working config
    fs.copyFileSync(exampleConfigPath, configPath);
    console.log('✓ Successfully copied config.cjs.example to config.cjs');
    console.log('');
    console.log('📝 Next steps:');
    console.log('  1. Edit config.cjs with your private settings');
    console.log('  2. config.cjs will not be tracked by git (it\'s in .gitignore)');
    console.log('  3. Your private settings will remain local to your server');
  } catch (error) {
    console.error('✗ Error copying config file:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setupConfig();
}

module.exports = { setupConfig };