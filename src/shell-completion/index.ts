/**
 * ABOUTME: Shell completion support for Ralph TUI.
 * Provides shell completion scripts and integration for various shells.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

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
      COMPREPLY=(\$(compgen -W "claude opencode iflow gemini codex kiro cursor droid" -- "\$cur"))
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
    'chat:Start a chat session'
    'task:Execute a one-off task'
    'prd:Generate a PRD'
    'skills:Manage skills'
    'setup:Setup wizard'
    'config:Configuration management'
    'status:Show status'
    'version:Show version'
    'help:Show help'
  )
  
  flags=(
    '--help[Show help]'
    '--version[Show version]'
    '--verbose[Verbose output]'
    '--quiet[Quiet output]'
    '--agent[Specify agent]:agent:(claude opencode iflow gemini codex kiro cursor droid)'
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
  
  _arguments -C \\
    \${commands[@]} \\
    \${flags[@]} \\
    && return 0
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
complete -c ralph-tui -n __fish_use_subcommand -a chat -d 'Start a chat session'
complete -c ralph-tui -n __fish_use_subcommand -a task -d 'Execute a one-off task'
complete -c ralph-tui -n __fish_use_subcommand -a prd -d 'Generate a PRD'
complete -c ralph-tui -n __fish_use_subcommand -a skills -d 'Manage skills'
complete -c ralph-tui -n __fish_use_subcommand -a setup -d 'Setup wizard'
complete -c ralph-tui -n __fish_use_subcommand -a config -d 'Configuration management'
complete -c ralph-tui -n __fish_use_subcommand -a status -d 'Show status'
complete -c ralph-tui -n __fish_use_subcommand -a version -d 'Show version'
complete -c ralph-tui -n __fish_use_subcommand -a help -d 'Show help'

# Flags
complete -c ralph-tui -l help -d 'Show help'
complete -c ralph-tui -l version -d 'Show version'
complete -c ralph-tui -l verbose -d 'Verbose output'
complete -c ralph-tui -l quiet -d 'Quiet output'
complete -c ralph-tui -l agent -d 'Specify agent' -xa 'claude opencode iflow gemini codex kiro cursor droid'
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
        @{ Name = 'chat'; Description = 'Start a chat session' }
        @{ Name = 'task'; Description = 'Execute a one-off task' }
        @{ Name = 'prd'; Description = 'Generate a PRD' }
        @{ Name = 'skills'; Description = 'Manage skills' }
        @{ Name = 'setup'; Description = 'Setup wizard' }
        @{ Name = 'config'; Description = 'Configuration management' }
        @{ Name = 'status'; Description = 'Show status' }
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
    
    \$agents = @('claude', 'opencode', 'iflow', 'gemini', 'codex', 'kiro', 'cursor', 'droid')
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
export async function installShellCompletion(shell?: ShellType): Promise<void> {
  const detectedShell = shell || await detectShell();
  const script = generateCompletionScript(detectedShell);
  
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
}

/**
 * Detect the current shell.
 */
async function detectShell(): Promise<ShellType> {
  const shell = process.env.SHELL || '';
  
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('fish')) return 'fish';
  if (process.platform === 'win32') return 'powershell';
  
  // Default to bash for Unix-like systems
  return 'bash';
}

/**
 * Install bash completion.
 */
async function installBashCompletion(script: string): Promise<void> {
  const bashrcPath = `${process.env.HOME}/.bashrc`;
  const completionPath = `${process.env.HOME}/.local/share/bash-completion/completions/ralph-tui`;
  
  try {
    // Try system completion directory first
    await execAsync(`mkdir -p "${process.env.HOME}/.local/share/bash-completion/completions"`);
    await execAsync(`echo '${script.replace(/'/g, "'\\''")}' > "${completionPath}"`);
    console.log('Bash completion installed to:', completionPath);
  } catch (error) {
    // Fallback to .bashrc
    await execAsync(`echo '${script.replace(/'/g, "'\\''")}' >> "${bashrcPath}"`);
    console.log('Bash completion added to:', bashrcPath);
  }
}

/**
 * Install zsh completion.
 */
async function installZshCompletion(script: string): Promise<void> {
  const completionPath = `${process.env.HOME}/.zsh/completion/_ralph-tui`;
  
  try {
    await execAsync(`mkdir -p "${process.env.HOME}/.zsh/completion"`);
    await execAsync(`echo '${script.replace(/'/g, "'\\''")}' > "${completionPath}"`);
    
    // Add to fpath
    const zshrcPath = `${process.env.HOME}/.zshrc`;
    const fpathLine = 'fpath=($HOME/.zsh/completion $fpath)';
    
    try {
      const { stdout } = await execAsync(`grep -q "${fpathLine}" "${zshrcPath}" && echo exists || echo not_exists`);
      if (!stdout.includes('exists')) {
        await execAsync(`echo '${fpathLine}' >> "${zshrcPath}"`);
      }
    } catch {
      // Ignore grep errors
    }
    
    console.log('Zsh completion installed to:', completionPath);
  } catch (error) {
    throw new Error(`Failed to install zsh completion: ${error}`);
  }
}

/**
 * Install fish completion.
 */
async function installFishCompletion(script: string): Promise<void> {
  const completionPath = `${process.env.HOME}/.config/fish/completions/ralph-tui.fish`;
  
  try {
    await execAsync(`mkdir -p "${process.env.HOME}/.config/fish/completions"`);
    await execAsync(`echo '${script.replace(/'/g, "'\\''")}' > "${completionPath}"`);
    console.log('Fish completion installed to:', completionPath);
  } catch (error) {
    throw new Error(`Failed to install fish completion: ${error}`);
  }
}

/**
 * Install PowerShell completion.
 */
async function installPowerShellCompletion(script: string): Promise<void> {
  const profilePath = `${process.env.USERPROFILE}\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`;
  
  try {
    await execAsync(`echo '${script.replace(/'/g, "'`'")}' >> "${profilePath}"`);
    console.log('PowerShell completion added to profile:', profilePath);
  } catch (error) {
    throw new Error(`Failed to install PowerShell completion: ${error}`);
  }
}

/**
 * Check if shell completion is installed for the current shell.
 */
export async function isCompletionInstalled(shell?: ShellType): Promise<boolean> {
  const detectedShell = shell || await detectShell();
  
  try {
    switch (detectedShell) {
      case 'bash':
        // Check system completion or .bashrc
        const bashCompletionPath = `${process.env.HOME}/.local/share/bash-completion/completions/ralph-tui`;
        const bashrcPath = `${process.env.HOME}/.bashrc`;
        
        try {
          await execAsync(`test -f "${bashCompletionPath}"`);
          return true;
        } catch {
          const { stdout } = await execAsync(`grep -q "ralph-tui" "${bashrcPath}" && echo exists || echo not_exists`);
          return stdout.includes('exists');
        }
        
      case 'zsh':
        const zshCompletionPath = `${process.env.HOME}/.zsh/completion/_ralph-tui`;
        await execAsync(`test -f "${zshCompletionPath}"`);
        return true;
        
      case 'fish':
        const fishCompletionPath = `${process.env.HOME}/.config/fish/completions/ralph-tui.fish`;
        await execAsync(`test -f "${fishCompletionPath}"`);
        return true;
        
      case 'powershell':
        const profilePath = `${process.env.USERPROFILE}\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`;
        const { stdout } = await execAsync(`Get-Content "${profilePath}" | Select-String "ralph-tui" -Quiet`);
        return stdout.trim() === 'True';
        
      default:
        return false;
    }
  } catch {
    return false;
  }
}