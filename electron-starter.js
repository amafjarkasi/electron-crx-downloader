// This is a workaround for the "primordials is not defined" error
// It sets up the environment before requiring the main app

// Fix for the primordials issue
const path = require('path');
const Module = require('module');
const originalRequire = Module.prototype.require;

// Patch the require function to handle the primordials issue
Module.prototype.require = function(name) {
  try {
    return originalRequire.call(this, name);
  } catch (error) {
    if (error.code === 'ERR_UNKNOWN_BUILTIN_MODULE' || 
        (error.message && error.message.includes('primordials'))) {
      console.warn(`Warning: Module "${name}" had issues loading, attempting workaround`);
      process.env.NODE_OPTIONS = '--no-deprecation';
      return originalRequire.call(this, name);
    }
    throw error;
  }
};

// Load the actual application
require('./main.js');
