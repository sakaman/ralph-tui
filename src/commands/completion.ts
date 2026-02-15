/**
 * ABOUTME: Shell completion management commands.
 * Provides CLI commands for installing and managing shell completion.
 */

import { Command } from 'commander';
import {
  installShellCompletion,
  uninstallShellCompletion,
  isCompletionInstalled,
  generateCompletionScript,
  detectShell,
  getSupportedShells,
  getShellInfo,
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
  # Interactive shell selection and installation
  ralph-tui completion install
  
  # Install completion for specific shell
  ralph-tui completion install --shell zsh
  
  # Check if completion is installed
  ralph-tui completion check
  
  # Generate completion script (for manual installation)
  ralph-tui completion generate --shell bash
  
  # Uninstall completion
  ralph-tui completion uninstall
    `);

  command
    .command('install')
    .description('Install shell completion (interactive if no shell specified)')
    .option('-s, --shell <shell>', 'Shell type (bash, zsh, fish, powershell)', 'auto')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        let shell: ShellType | undefined;
        
        if (options.shell === 'auto') {
          // Auto-detect shell
          const detectedShell = await detectShell();
          const shellInfo = getShellInfo(detectedShell);
          
          if (!shellInfo) {
            console.error(`❌ Could not detect shell. Please specify with --shell option.`);
            process.exit(1);
          }
          
          console.log(`\n🔍 Detected shell: ${shellInfo.name} (${shellInfo.description})`);
          console.log(`   Config: ${shellInfo.configPath}`);
          console.log(`   Completion: ${shellInfo.completionPath}`);
          
          // Check if already installed
          const alreadyInstalled = await isCompletionInstalled(detectedShell);
          if (alreadyInstalled) {
            console.log(`\n✅ Shell completion is already installed for ${shellInfo.name}.`);
            console.log(`   Run 'ralph-tui completion uninstall' first to reinstall.`);
            return;
          }
          
          shell = detectedShell;
        } else {
          shell = options.shell as ShellType;
          const shellInfo = getShellInfo(shell);
          
          if (!shellInfo) {
            console.error(`❌ Unknown shell: ${shell}`);
            console.log(`   Supported shells: ${getSupportedShells().map(s => s.type).join(', ')}`);
            process.exit(1);
          }
          
          // Check if already installed
          const alreadyInstalled = await isCompletionInstalled(shell);
          if (alreadyInstalled) {
            console.log(`\n✅ Shell completion is already installed for ${shellInfo.name}.`);
            return;
          }
        }
        
        // Install completion
        const installedInfo = await installShellCompletion(shell);
        
        console.log(`\n✅ Shell completion installed successfully for ${installedInfo.name}!`);
        console.log(`   Completion file: ${installedInfo.completionPath}`);
        console.log(`\n💡 To activate, run:`);
        
        switch (shell) {
          case 'bash':
            console.log(`   source ~/.bashrc`);
            console.log(`   # Or start a new terminal`);
            break;
          case 'zsh':
            console.log(`   source ~/.zshrc`);
            console.log(`   # Or start a new terminal`);
            break;
          case 'fish':
            console.log(`   # Fish auto-loads completions, just start a new terminal`);
            break;
          case 'powershell':
            console.log(`   . $PROFILE`);
            console.log(`   # Or start a new PowerShell session`);
            break;
        }
      } catch (error) {
        console.error('❌ Failed to install shell completion:', error);
        process.exit(1);
      }
    });

  command
    .command('uninstall')
    .description('Uninstall shell completion')
    .option('-s, --shell <shell>', 'Shell type (bash, zsh, fish, powershell)', 'auto')
    .action(async (options) => {
      try {
        const shell = options.shell === 'auto' ? undefined : options.shell as ShellType;
        const installedInfo = await uninstallShellCompletion(shell);
        
        console.log(`✅ Shell completion uninstalled for ${installedInfo.name}`);
        console.log(`   Removed: ${installedInfo.completionPath}`);
      } catch (error) {
        console.error('❌ Failed to uninstall shell completion:', error);
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
        const detectedShell = shell || await detectShell();
        const shellInfo = getShellInfo(detectedShell);
        const installed = await isCompletionInstalled(detectedShell);
        
        console.log(`\nShell: ${shellInfo?.name || detectedShell}`);
        console.log(`Completion path: ${shellInfo?.completionPath || 'unknown'}`);
        
        if (installed) {
          console.log(`\n✅ Shell completion is installed`);
        } else {
          console.log(`\n❌ Shell completion is not installed`);
          console.log(`   Run 'ralph-tui completion install' to install it.`);
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

  command
    .command('list')
    .description('List supported shells and their status')
    .action(async () => {
      console.log('\nSupported shells:\n');
      
      const shells = getSupportedShells();
      const detectedShell = await detectShell();
      
      for (const shell of shells) {
        const installed = await isCompletionInstalled(shell.type);
        const isCurrent = shell.type === detectedShell;
        
        const status = installed ? '✅ installed' : '❌ not installed';
        const current = isCurrent ? ' (current)' : '';
        
        console.log(`  ${shell.name}${current}:`);
        console.log(`    Status: ${status}`);
        console.log(`    Description: ${shell.description}`);
        console.log(`    Completion: ${shell.completionPath}`);
        console.log('');
      }
    });

  return command;
}
