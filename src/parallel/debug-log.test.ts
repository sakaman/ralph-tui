/**
 * ABOUTME: Tests for the debug logging utility for parallel execution.
 * Verifies that debug functions correctly log git status, worktree info, and branch commits.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import {
  initDebugLog,
  debugLog,
  logGitStatus,
  logWorktreeInfo,
  logBranchCommits,
  closeDebugLog,
} from './debug-log.js';

describe('debug-log', () => {
  let tempDir: string;
  let logFiles: string[] = [];

  beforeEach(() => {
    // Create a temporary directory with a git repo for testing
    tempDir = fs.mkdtempSync(path.join('/tmp', 'debug-log-test-'));
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "test@test.com"', { cwd: tempDir });
    execSync('git config user.name "Test User"', { cwd: tempDir });
    // Create an initial commit so HEAD exists
    fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });
  });

  afterEach(() => {
    // Close the debug log to reset state
    closeDebugLog();
    // Clean up log files
    for (const logFile of logFiles) {
      try {
        fs.unlinkSync(logFile);
      } catch {
        // Ignore if already deleted
      }
    }
    logFiles = [];
    // Clean up temp directory
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('initDebugLog', () => {
    test('creates a log file with header', () => {
      initDebugLog(tempDir);

      // Find the created log file
      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      expect(logFile).toBeDefined();

      const logPath = path.join(tempDir, logFile!);
      logFiles.push(logPath);

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('PARALLEL EXECUTION DEBUG LOG');
      expect(content).toContain(`Project CWD: ${tempDir}`);
    });
  });

  describe('debugLog', () => {
    test('does nothing when logging is disabled', () => {
      // Don't call initDebugLog - logging should be disabled
      debugLog('test', 'This should not be logged');
      // No error should be thrown, and no file should be created
      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      expect(logFile).toBeUndefined();
    });

    test('writes log entry with data when enabled', () => {
      initDebugLog(tempDir);

      debugLog('TestCategory', 'Test message', { key: 'value', number: 42 });

      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      const logPath = path.join(tempDir, logFile!);
      logFiles.push(logPath);

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('[TestCategory] Test message');
      expect(content).toContain('"key": "value"');
      expect(content).toContain('"number": 42');
    });
  });

  describe('logGitStatus', () => {
    test('logs git status for a valid git directory', () => {
      initDebugLog(tempDir);

      logGitStatus('TestCategory', tempDir, 'test context');

      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      const logPath = path.join(tempDir, logFile!);
      logFiles.push(logPath);

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('Git status for test context');
      expect(content).toContain('"branch"');
      expect(content).toContain('"head"');
    });

    test('logs error for invalid git directory', () => {
      initDebugLog(tempDir);

      // Use a non-git directory
      const nonGitDir = fs.mkdtempSync(path.join('/tmp', 'non-git-'));
      try {
        logGitStatus('TestCategory', nonGitDir, 'invalid context');

        const files = fs.readdirSync(tempDir);
        const logFile = files.find(f => f.startsWith('parallel-debug-'));
        const logPath = path.join(tempDir, logFile!);
        logFiles.push(logPath);

        const content = fs.readFileSync(logPath, 'utf-8');
        expect(content).toContain('Git status FAILED for invalid context');
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
      }
    });

    test('does nothing when logging is disabled', () => {
      // Don't call initDebugLog
      logGitStatus('TestCategory', tempDir, 'test context');
      // No error should be thrown
      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      expect(logFile).toBeUndefined();
    });
  });

  describe('logWorktreeInfo', () => {
    test('logs worktree list for a valid git directory', () => {
      initDebugLog(tempDir);

      logWorktreeInfo('TestCategory', tempDir);

      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      const logPath = path.join(tempDir, logFile!);
      logFiles.push(logPath);

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('Worktree list');
      expect(content).toContain('"worktrees"');
    });

    test('logs error for invalid git directory', () => {
      initDebugLog(tempDir);

      const nonGitDir = fs.mkdtempSync(path.join('/tmp', 'non-git-'));
      try {
        logWorktreeInfo('TestCategory', nonGitDir);

        const files = fs.readdirSync(tempDir);
        const logFile = files.find(f => f.startsWith('parallel-debug-'));
        const logPath = path.join(tempDir, logFile!);
        logFiles.push(logPath);

        const content = fs.readFileSync(logPath, 'utf-8');
        expect(content).toContain('Worktree list FAILED');
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
      }
    });

    test('does nothing when logging is disabled', () => {
      logWorktreeInfo('TestCategory', tempDir);
      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      expect(logFile).toBeUndefined();
    });
  });

  describe('logBranchCommits', () => {
    test('logs branch commit info for an existing branch', () => {
      initDebugLog(tempDir);

      // Get the current branch name
      const branchName = execSync('git branch --show-current', { cwd: tempDir, encoding: 'utf-8' }).trim();

      logBranchCommits('TestCategory', tempDir, branchName);

      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      const logPath = path.join(tempDir, logFile!);
      logFiles.push(logPath);

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain(`Branch commit check: ${branchName}`);
      expect(content).toContain('"commitsAhead"');
      expect(content).toContain('"branchHead"');
      expect(content).toContain('"mainHead"');
    });

    test('logs error for non-existent branch', () => {
      initDebugLog(tempDir);

      logBranchCommits('TestCategory', tempDir, 'non-existent-branch-xyz');

      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      const logPath = path.join(tempDir, logFile!);
      logFiles.push(logPath);

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('Branch commit check FAILED: non-existent-branch-xyz');
    });

    test('does nothing when logging is disabled', () => {
      logBranchCommits('TestCategory', tempDir, 'main');
      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      expect(logFile).toBeUndefined();
    });
  });

  describe('closeDebugLog', () => {
    test('writes footer and disables logging', () => {
      initDebugLog(tempDir);

      const files = fs.readdirSync(tempDir);
      const logFile = files.find(f => f.startsWith('parallel-debug-'));
      const logPath = path.join(tempDir, logFile!);
      logFiles.push(logPath);

      closeDebugLog();

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('DEBUG LOG ENDED');

      // Verify logging is disabled after close
      debugLog('TestCategory', 'Should not appear');
      const contentAfter = fs.readFileSync(logPath, 'utf-8');
      expect(contentAfter).not.toContain('Should not appear');
    });

    test('does nothing when logging is already disabled', () => {
      // Don't call initDebugLog
      closeDebugLog(); // Should not throw
    });
  });
});
