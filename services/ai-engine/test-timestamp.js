#!/usr/bin/env node

/**
 * Test script to verify timestamp calculation in AI prompt
 */

import { getSystemPrompt } from './dist/prompts.js';

console.log('=== Testing Dynamic System Prompt ===\n');

// Generate prompt
const prompt = getSystemPrompt();

console.log(prompt);

console.log('\n=== Timestamp Extraction ===\n');

// Extract timestamp from prompt
const timestampMatch = prompt.match(/Current timestamp \(milliseconds\): (\d+)/);
if (timestampMatch) {
  const promptTimestamp = parseInt(timestampMatch[1]);
  const actualTimestamp = Date.now();

  console.log(`Prompt timestamp: ${promptTimestamp}`);
  console.log(`Actual timestamp: ${actualTimestamp}`);
  console.log(`Difference: ${actualTimestamp - promptTimestamp} ms`);

  // Calculate 2 minutes from prompt time
  const twoMinutesLater = promptTimestamp + (2 * 60 * 1000);
  console.log(`\n2 minutes from prompt time: ${twoMinutesLater}`);
  console.log(`Date: ${new Date(twoMinutesLater).toISOString()}`);

  // Verify it's in the future
  if (twoMinutesLater > Date.now()) {
    console.log('✅ Timestamp is in the future (VALID)');
  } else {
    console.log('❌ Timestamp is in the past (INVALID)');
  }
}

console.log('\n=== Example Calculations ===\n');
const now = Date.now();
console.log(`Current time: ${now} (${new Date(now).toISOString()})`);
console.log(`2 minutes:    ${now + 2*60*1000} (${new Date(now + 2*60*1000).toISOString()})`);
console.log(`1 hour:       ${now + 60*60*1000} (${new Date(now + 60*60*1000).toISOString()})`);
console.log(`1 day:        ${now + 24*60*60*1000} (${new Date(now + 24*60*60*1000).toISOString()})`);
