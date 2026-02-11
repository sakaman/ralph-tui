/**
 * ABOUTME: Shell completion management commands.
 * Provides CLI commands for installing and managing shell completion.
 */

import { Command } from 'commander';
import {
  installShellCompletion,
  isCompletionInstalled,
  generateCompletionScript,
  type ShellType,
} from '../shell-completion/index.js';

/**
 * Create the completion command.
 */
export function createCompletionCommand(): Command {
  const command = new Command('completion')
    .description('Manage shell completion for Ralph TUI')
    .addHelpText('after', `
Examples:
  # Install completion for current shell
  ralph-tui completion install
  
  # Install completion for specific shell
  ralph-tui completion install --shell zsh
  
  # Check if completion is installed
  ralph-tui completion check
  
  # Generate completion script
  ralph-tui completion generate --shell bash
    `);

  command
    .command('install')
    .description('Install shell completion')
    .option('-s, --shell <shell>', 'Shell type (bash, zsh, fish, powershell)', 'auto')
    .action(async (options) => {
      try {
        const shell = options.shell === 'auto' ? undefined : options.shell as ShellType;
        await installShellCompletion(shell);
        console.log('✅ Shell completion installed successfully!');
        console.log('Restart your shell or run `source ~/.bashrc` (for bash) to activate.');
      } catch (error) {
        console.error('❌ Failed to install shell completion:', error);
        process.exit(1);
      }
    });

  command
    .command('check')
    .description('Check if shell completion is installed')
    .option('-s, --shell <shell>', 'Shell type (bash, zsh, fish, powershell)', 'auto')
    .action(async (options) => {
      try {
        const shell = options.shell === 'auto' ? undefined : options.shell as ShellType;
        const installed = await isCompletionInstalled(shell);
        
        if (installed) {
          console.log('✅ Shell completion is installed');
        } else {
          console.log('❌ Shell completion is not installed');
          console.log('Run `ralph-tui completion install` to install it.');
        }
      } catch (error) {
        console.error('❌ Failed to check shell completion:', error);
        process.exit(1);
      }
    });

  command
    .command('generate')
    .description('Generate shell completion script')
    .requiredOption('-s, --shell <shell>', 'Shell type (bash, zsh, fish, powershell)')
    .action((options) => {
      try {
        const script = generateCompletionScript(options.shell as ShellType);
        console.log(script);
      } catch (error) {
        console.error('❌ Failed to generate completion script:', error);
        process.exit(1);
      }
    });

  return command;
}