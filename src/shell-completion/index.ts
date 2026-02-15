/**
 * ABOUTME: Shell completion support for Ralph TUI.
 * Provides shell completion scripts and integration for various shells.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Shell types supported by Ralph TUI.
 */
export type ShellType = 'bash' | 'zsh' | 'fish' | 'powershell';

/**
 * Shell completion configuration.
 */
export interface ShellCompletionConfig {
  /** Shell type */
  shell: ShellType;
  
  /** Whether completion is enabled */
  enabled: boolean;
  
  /** Path to completion script */
  scriptPath?: string;
}

/**
 * Shell info for display purposes.
 */
export interface ShellInfo {
  type: ShellType;
  name: string;
  description: string;
  configPath: string;
  completionPath: string;
}

/**
 * Get information about supported shells.
 */
export function getSupportedShells(): ShellInfo[] {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const userProfile = process.env.USERPROFILE || '';
  
  return [
    {
      type: 'bash',
      name: 'Bash',
      description: 'Bourne Again Shell',
      configPath: `${home}/.bashrc`,
      completionPath: `${home}/.local/share/bash-completion/completions/ralph-tui`,
    },
    {
      type: 'zsh',
      name: 'Zsh',
      description: 'Z Shell',
      configPath: `${home}/.zshrc`,
      completionPath: `${home}/.zsh/completion/_ralph-tui`,
    },
    {
      type: 'fish',
      name: 'Fish',
      description: 'Friendly Interactive Shell',
      configPath: `${home}/.config/fish/config.fish`,
      completionPath: `${home}/.config/fish/completions/ralph-tui.fish`,
    },
    {
      type: 'powershell',
      name: 'PowerShell',
      description: 'Windows PowerShell',
      configPath: `${userProfile}\\Documents\\WindowsPowerShell\\Microsoft.PowerShell_profile.ps1`,
      completionPath: `${userProfile}\\Documents\\WindowsPowerShell\\Microsoft.PowerShell_profile.ps1`,
    },
  ];
}

/**
 * Detect the current shell.
 */
export async function detectShell(): Promise<ShellType> {
  const shell = process.env.SHELL || '';
  
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('fish')) return 'fish';
  if (process.platform === 'win32') return 'powershell';
  
  // Default to bash for Unix-like systems
  return 'bash';
}

/**
 * Get shell info by type.
 */
export function getShellInfo(shellType: ShellType): ShellInfo | undefined {
  return getSupportedShells().find(s => s.type === shellType);
}

/**
 * Generate shell completion script for a specific shell.
 */
export function generateCompletionScript(shell: ShellType): string {
  switch (shell) {
    case 'bash':
      return generateBashCompletion();
    case 'zsh':
      return generateZshCompletion();
    case 'fish':
      return generateFishCompletion();
    case 'powershell':
      return generatePowerShellCompletion();
    default:
      throw new Error(`Unsupported shell: ${shell}`);
  }
}

/**
 * Generate bash completion script.
 */
function generateBashCompletion(): string {
  return `# bash completion for Ralph TUI

_ralph_tui() {
  local cur prev words cword
  _init_completion || return

  case "\${prev}" in
    --agent)
      COMPREPLY=(\$(compgen -W "claude opencode iflow-cli gemini codex kiro cursor droid" -- "\$cur"))
      ;;
    --model)
      # Model completion would be agent-specific
      COMPREPLY=(\$(compgen -W "gpt-4 gpt-3.5-turbo claude-3-opus claude-3-sonnet gemini-pro" -- "\$cur"))
      ;;
    --skill)
      # Complete with available skills
      if command -v ralph-tui >/dev/null 2>&1; then
        COMPREPLY=(\$(compgen -W "\$(ralph-tui skills list --names-only)" -- "\$cur"))
      fi
      ;;
    *)
      # Complete with available commands and flags
      if [[ \$cur == -* ]]; then
        COMPREPLY=(\$(compgen -W "
          --help --version --verbose --quiet
          --agent --model --skill --timeout
          --cwd --env --flags --config
          --no-stream --stream --interactive
          --prd --task --chat --skills
          --setup --config-path --log-level
        " -- "\$cur"))
      else
        COMPREPLY=(\$(compgen -W "
          chat task prd skills setup
          config status version help
          run resume logs listen remote
          completion convert create-prd doctor
          info plugins template
        " -- "\$cur"))
      fi
      ;;
  esac
}

complete -F _ralph_tui ralph-tui
`;
}

/**
 * Generate zsh completion script.
 */
function generateZshCompletion(): string {
  return `#compdef ralph-tui

# zsh completion for Ralph TUI

_ralph_tui() {
  local -a commands flags
  
  commands=(
    'run:Run Ralph TUI execution loop'
    'resume:Resume an interrupted session'
    'status:Show session status'
    'logs:View iteration logs'
    'listen:Run with remote listener'
    'remote:Manage remote connections'
    'completion:Manage shell completion'
    'convert:Convert PRD format'
    'create-prd:Create a PRD interactively'
    'doctor:Run diagnostics'
    'info:Show system info'
    'plugins:List plugins'
    'template:Show prompt template'
    'chat:Start a chat session'
    'task:Execute a one-off task'
    'prd:Generate a PRD'
    'skills:Manage skills'
    'setup:Setup wizard'
    'config:Configuration management'
    'version:Show version'
    'help:Show help'
  )
  
  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi
  
  flags=(
    '--help[Show help]'
    '--version[Show version]'
    '--verbose[Verbose output]'
    '--quiet[Quiet output]'
    '--agent[Specify agent]:agent:(claude opencode iflow-cli gemini codex kiro cursor droid)'
    '--model[Specify model]:model'
    '--skill[Specify skill]:skill'
    '--timeout[Execution timeout]:timeout'
    '--cwd[Working directory]:directory:_files -/' 
    '--env[Environment variables]:env'
    '--flags[Additional flags]:flags'
    '--config[Configuration file]:file:_files'
    '--no-stream[Disable streaming]'
    '--stream[Enable streaming]'
    '--interactive[Interactive mode]'
    '--prd[PRD mode]'
    '--task[Task mode]'
    '--chat[Chat mode]'
    '--skills[Skills mode]'
    '--setup[Setup mode]'
    '--config-path[Config path]:directory:_files -/'
    '--log-level[Log level]:level:(debug info warn error)'
  )
  
  _arguments -s -S \\
    \${flags[@]} \\
    '*:: :->_default'
}

_ralph_tui "\$@"
`;
}

/**
 * Generate fish completion script.
 */
function generateFishCompletion(): string {
  return `# fish completion for Ralph TUI

complete -c ralph-tui -f

# Commands
complete -c ralph-tui -n __fish_use_subcommand -a run -d 'Run Ralph TUI execution loop'
complete -c ralph-tui -n __fish_use_subcommand -a resume -d 'Resume an interrupted session'
complete -c ralph-tui -n __fish_use_subcommand -a status -d 'Show session status'
complete -c ralph-tui -n __fish_use_subcommand -a logs -d 'View iteration logs'
complete -c ralph-tui -n __fish_use_subcommand -a listen -d 'Run with remote listener'
complete -c ralph-tui -n __fish_use_subcommand -a remote -d 'Manage remote connections'
complete -c ralph-tui -n __fish_use_subcommand -a completion -d 'Manage shell completion'
complete -c ralph-tui -n __fish_use_subcommand -a convert -d 'Convert PRD format'
complete -c ralph-tui -n __fish_use_subcommand -a create-prd -d 'Create a PRD interactively'
complete -c ralph-tui -n __fish_use_subcommand -a doctor -d 'Run diagnostics'
complete -c ralph-tui -n __fish_use_subcommand -a info -d 'Show system info'
complete -c ralph-tui -n __fish_use_subcommand -a plugins -d 'List plugins'
complete -c ralph-tui -n __fish_use_subcommand -a template -d 'Show prompt template'
complete -c ralph-tui -n __fish_use_subcommand -a chat -d 'Start a chat session'
complete -c ralph-tui -n __fish_use_subcommand -a task -d 'Execute a one-off task'
complete -c ralph-tui -n __fish_use_subcommand -a prd -d 'Generate a PRD'
complete -c ralph-tui -n __fish_use_subcommand -a skills -d 'Manage skills'
complete -c ralph-tui -n __fish_use_subcommand -a setup -d 'Setup wizard'
complete -c ralph-tui -n __fish_use_subcommand -a config -d 'Configuration management'
complete -c ralph-tui -n __fish_use_subcommand -a version -d 'Show version'
complete -c ralph-tui -n __fish_use_subcommand -a help -d 'Show help'

# Flags
complete -c ralph-tui -l help -d 'Show help'
complete -c ralph-tui -l version -d 'Show version'
complete -c ralph-tui -l verbose -d 'Verbose output'
complete -c ralph-tui -l quiet -d 'Quiet output'
complete -c ralph-tui -l agent -d 'Specify agent' -xa 'claude opencode iflow-cli gemini codex kiro cursor droid'
complete -c ralph-tui -l model -d 'Specify model'
complete -c ralph-tui -l skill -d 'Specify skill'
complete -c ralph-tui -l timeout -d 'Execution timeout'
complete -c ralph-tui -l cwd -d 'Working directory' -xa '(__fish_complete_directories)'
complete -c ralph-tui -l env -d 'Environment variables'
complete -c ralph-tui -l flags -d 'Additional flags'
complete -c ralph-tui -l config -d 'Configuration file' -xa '(__fish_complete_path)'
complete -c ralph-tui -l no-stream -d 'Disable streaming'
complete -c ralph-tui -l stream -d 'Enable streaming'
complete -c ralph-tui -l interactive -d 'Interactive mode'
complete -c ralph-tui -l prd -d 'PRD mode'
complete -c ralph-tui -l task -d 'Task mode'
complete -c ralph-tui -l chat -d 'Chat mode'
complete -c ralph-tui -l skills -d 'Skills mode'
complete -c ralph-tui -l setup -d 'Setup mode'
complete -c ralph-tui -l config-path -d 'Config path' -xa '(__fish_complete_directories)'
complete -c ralph-tui -l log-level -d 'Log level' -xa 'debug info warn error'
`;
}

/**
 * Generate PowerShell completion script.
 */
function generatePowerShellCompletion(): string {
  return `# PowerShell completion for Ralph TUI

Register-ArgumentCompleter -CommandName ralph-tui -ScriptBlock {
    param(\$wordToComplete, \$commandAst, \$cursorPosition)
    
    \$commands = @(
        @{ Name = 'run'; Description = 'Run Ralph TUI execution loop' }
        @{ Name = 'resume'; Description = 'Resume an interrupted session' }
        @{ Name = 'status'; Description = 'Show session status' }
        @{ Name = 'logs'; Description = 'View iteration logs' }
        @{ Name = 'listen'; Description = 'Run with remote listener' }
        @{ Name = 'remote'; Description = 'Manage remote connections' }
        @{ Name = 'completion'; Description = 'Manage shell completion' }
        @{ Name = 'convert'; Description = 'Convert PRD format' }
        @{ Name = 'create-prd'; Description = 'Create a PRD interactively' }
        @{ Name = 'doctor'; Description = 'Run diagnostics' }
        @{ Name = 'info'; Description = 'Show system info' }
        @{ Name = 'plugins'; Description = 'List plugins' }
        @{ Name = 'template'; Description = 'Show prompt template' }
        @{ Name = 'chat'; Description = 'Start a chat session' }
        @{ Name = 'task'; Description = 'Execute a one-off task' }
        @{ Name = 'prd'; Description = 'Generate a PRD' }
        @{ Name = 'skills'; Description = 'Manage skills' }
        @{ Name = 'setup'; Description = 'Setup wizard' }
        @{ Name = 'config'; Description = 'Configuration management' }
        @{ Name = 'version'; Description = 'Show version' }
        @{ Name = 'help'; Description = 'Show help' }
    )
    
    \$flags = @(
        '--help', '--version', '--verbose', '--quiet',
        '--agent', '--model', '--skill', '--timeout',
        '--cwd', '--env', '--flags', '--config',
        '--no-stream', '--stream', '--interactive',
        '--prd', '--task', '--chat', '--skills',
        '--setup', '--config-path', '--log-level'
    )
    
    \$agents = @('claude', 'opencode', 'iflow-cli', 'gemini', 'codex', 'kiro', 'cursor', 'droid')
    \$logLevels = @('debug', 'info', 'warn', 'error')
    
    if (\$wordToComplete -match '^--') {
        \$flags | Where-Object { \$_ -like "\$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new(\$_, \$_, 'ParameterName', \$_)
        }
    } else {
        \$commands | Where-Object { \$_.Name -like "\$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new(\$_.Name, \$_.Name, 'Command', \$_.Description)
        }
    }
}
`;
}

/**
 * Install shell completion for the current shell.
 */
export async function installShellCompletion(shell?: ShellType): Promise<ShellInfo> {
  const detectedShell = shell || await detectShell();
  const script = generateCompletionScript(detectedShell);
  const shellInfo = getShellInfo(detectedShell);
  
  if (!shellInfo) {
    throw new Error(`Unknown shell: ${detectedShell}`);
  }
  
  switch (detectedShell) {
    case 'bash':
      await installBashCompletion(script);
      break;
    case 'zsh':
      await installZshCompletion(script);
      break;
    case 'fish':
      await installFishCompletion(script);
      break;
    case 'powershell':
      await installPowerShellCompletion(script);
      break;
    default:
      throw new Error(`Cannot install completion for shell: ${detectedShell}`);
  }
  
  return shellInfo;
}

/**
 * Install bash completion.
 */
async function installBashCompletion(script: string): Promise<void> {
  const home = process.env.HOME || '';
  const completionDir = `${home}/.local/share/bash-completion/completions`;
  const completionPath = `${completionDir}/ralph-tui`;
  
  // Ensure directory exists
  await fs.promises.mkdir(completionDir, { recursive: true });
  
  // Write completion script
  await fs.promises.writeFile(completionPath, script, 'utf-8');
}

/**
 * Install zsh completion.
 */
async function installZshCompletion(script: string): Promise<void> {
  const home = process.env.HOME || '';
  const completionDir = `${home}/.zsh/completion`;
  const completionPath = `${completionDir}/_ralph-tui`;
  
  // Ensure directory exists
  await fs.promises.mkdir(completionDir, { recursive: true });
  
  // Write completion script
  await fs.promises.writeFile(completionPath, script, 'utf-8');
  
  // Add to fpath in .zshrc if not already there
  const zshrcPath = `${home}/.zshrc`;
  const fpathLine = 'fpath=($HOME/.zsh/completion $fpath)';
  const compinitLine = 'autoload -Uz compinit && compinit';
  
  try {
    let zshrcContent = '';
    try {
      zshrcContent = await fs.promises.readFile(zshrcPath, 'utf-8');
    } catch {
      // File doesn't exist, create it
      zshrcContent = '';
    }
    
    // Add fpath if not present
    if (!zshrcContent.includes(fpathLine)) {
      const updatedContent = zshrcContent + `\n# Ralph TUI completion\n${fpathLine}\n`;
      await fs.promises.writeFile(zshrcPath, updatedContent, 'utf-8');
    }
    
    // Ensure compinit is present
    if (!zshrcContent.includes('compinit')) {
      await fs.promises.appendFile(zshrcPath, `\n${compinitLine}\n`, 'utf-8');
    }
  } catch (error) {
    // Non-fatal - completion script is installed, just may need manual config
  }
}

/**
 * Install fish completion.
 */
async function installFishCompletion(script: string): Promise<void> {
  const home = process.env.HOME || '';
  const completionDir = `${home}/.config/fish/completions`;
  const completionPath = `${completionDir}/ralph-tui.fish`;
  
  // Ensure directory exists
  await fs.promises.mkdir(completionDir, { recursive: true });
  
  // Write completion script
  await fs.promises.writeFile(completionPath, script, 'utf-8');
}

/**
 * Install PowerShell completion.
 */
async function installPowerShellCompletion(script: string): Promise<void> {
  const userProfile = process.env.USERPROFILE || '';
  const profileDir = `${userProfile}\\Documents\\WindowsPowerShell`;
  const profilePath = `${profileDir}\\Microsoft.PowerShell_profile.ps1`;
  
  // Ensure directory exists
  await fs.promises.mkdir(profileDir, { recursive: true });
  
  // Check if already installed
  let profileContent = '';
  try {
    profileContent = await fs.promises.readFile(profilePath, 'utf-8');
  } catch {
    // File doesn't exist
  }
  
  if (!profileContent.includes('Register-ArgumentCompleter -CommandName ralph-tui')) {
    await fs.promises.appendFile(profilePath, `\n${script}\n`, 'utf-8');
  }
}

/**
 * Check if shell completion is installed for the current shell.
 */
export async function isCompletionInstalled(shell?: ShellType): Promise<boolean> {
  const detectedShell = shell || await detectShell();
  const shellInfo = getShellInfo(detectedShell);
  
  if (!shellInfo) {
    return false;
  }
  
  try {
    await fs.promises.access(shellInfo.completionPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Uninstall shell completion for the current shell.
 */
export async function uninstallShellCompletion(shell?: ShellType): Promise<ShellInfo> {
  const detectedShell = shell || await detectShell();
  const shellInfo = getShellInfo(detectedShell);
  
  if (!shellInfo) {
    throw new Error(`Unknown shell: ${detectedShell}`);
  }
  
  try {
    await fs.promises.unlink(shellInfo.completionPath);
  } catch {
    // File may not exist
  }
  
  return shellInfo;
}
