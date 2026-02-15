/**
 * ABOUTME: iFlow CLI Agent plugin for Ralph TUI.
 * Integrates with the iFlow CLI agent for AI-assisted development.
 */

import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import { BaseAgentPlugin, findCommandPath, quoteForWindowsShell } from '../base.js';
import type {
  AgentPluginMeta,
  AgentDetectResult,
  AgentExecuteOptions,
  AgentExecutionHandle,
  AgentExecutionResult,
  AgentSetupQuestion,
  AgentPreflightResult,
} from '../types.js';

const execAsync = promisify(exec);

/** Counter for generating unique execution IDs */
let executionCounter = 0;

/**
 * Generate a unique execution ID.
 */
function generateExecutionId(): string {
  executionCounter++;
  return `iflow-${Date.now()}-${executionCounter}`;
}

/**
 * iFlow CLI Agent plugin implementation.
 */
export class IFlowAgentPlugin extends BaseAgentPlugin {
  readonly meta: AgentPluginMeta = {
    id: 'iflow-cli',
    name: 'iFlow CLI',
    description: 'iFlow CLI agent for AI-assisted development',
    version: '1.0.0',
    author: 'Ralph TUI Team',
    defaultCommand: 'iflow',
    supportsStreaming: true,
    supportsInterrupt: true,
    supportsFileContext: true,
    supportsSubagentTracing: false, // iFlow doesn't support structured output yet
    structuredOutputFormat: undefined,
    skillsPaths: {
      personal: '~/.iflow/skills/',
      repo: '.iflow/skills/',
    },
  };

  /** Current running process (if any) */
  private currentProcess?: ChildProcess;

  /**
   * Initialize the plugin with configuration.
   */
  override async initialize(config: Record<string, unknown>): Promise<void> {
    await super.initialize(config);
  }

  /**
   * Detect if iFlow CLI is available on the system.
   */
  override async detect(): Promise<AgentDetectResult> {
    const command = this.commandPath ?? this.meta.defaultCommand;
    const findResult = await findCommandPath(command);

    if (!findResult.found) {
      return {
        available: false,
        error: `iFlow CLI not found in PATH. Install from: https://github.com/sakaman/iflow`,
      };
    }

    try {
      const { stdout, stderr } = await execAsync(`"${findResult.path}" --version`, {
        timeout: 10000,
      });

      const versionMatch = stdout.match(/iflow\s+v?(\d+\.\d+\.\d+)/i) ||
                          stderr.match(/iflow\s+v?(\d+\.\d+\.\d+)/i);

      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        available: true,
        version,
        executablePath: findResult.path,
      };
    } catch (error) {
      return {
        available: false,
        executablePath: findResult.path,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute iFlow CLI with the given prompt.
   */
  override execute(
    prompt: string,
    files?: import('../types.js').AgentFileContext[],
    options?: AgentExecuteOptions
  ): AgentExecutionHandle {
    const executionId = generateExecutionId();
    const startTime = Date.now();
    const startTimestamp = new Date().toISOString();

    // Build iFlow command arguments
    const args: string[] = [];

    // Add file context if provided
    if (files && files.length > 0) {
      const fileArgs = files.map(file => {
        if (file.line && file.column) {
          return `${file.path}:${file.line}:${file.column}`;
        } else if (file.line) {
          return `${file.path}:${file.line}`;
        }
        return file.path;
      });
      args.push('--files', ...fileArgs);
    }

    // Add timeout if specified
    if (options?.timeout && options.timeout > 0) {
      args.push('--timeout', Math.ceil(options.timeout / 1000).toString());
    }

    // Add any additional flags from options
    if (options?.flags) {
      args.push(...options.flags);
    }

    // Add default flags
    if (this.defaultFlags.length > 0) {
      args.push(...this.defaultFlags);
    }

    const cwd = options?.cwd || process.cwd();
    const command = this.commandPath ?? this.meta.defaultCommand;

    // Set up environment variables
    const env = { ...process.env, ...options?.env };

    // Start the execution using spawn for better control
    const childProcess = spawn(command, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    // Store the process for interruption
    this.currentProcess = childProcess;

    // Write prompt to stdin
    childProcess.stdin?.write(prompt);
    childProcess.stdin?.end();

    const executionPromise = new Promise<AgentExecutionResult>((resolve) => {
      let stdout = '';
      let stderr = '';

      // Handle stdout streaming
      childProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        options?.onStdout?.(chunk);
      });

      // Handle stderr streaming
      childProcess.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        options?.onStderr?.(chunk);
      });

      childProcess.on('close', (code) => {
        const endTime = Date.now();
        const endTimestamp = new Date().toISOString();
        const durationMs = endTime - startTime;

        const result: AgentExecutionResult = {
          executionId,
          status: code === 0 ? 'completed' : 'failed',
          exitCode: code ?? undefined,
          stdout,
          stderr,
          durationMs,
          interrupted: false,
          startedAt: startTimestamp,
          endedAt: endTimestamp,
        };

        if (code !== 0 && !stderr) {
          result.error = `iFlow process exited with code ${code}`;
        } else if (stderr) {
          result.error = stderr.trim();
        }

        this.currentProcess = undefined;
        resolve(result);
        options?.onEnd?.(result);
      });

      childProcess.on('error', (error) => {
        const endTime = Date.now();
        const endTimestamp = new Date().toISOString();
        const durationMs = endTime - startTime;

        const result: AgentExecutionResult = {
          executionId,
          status: 'failed',
          stdout: '',
          stderr: error.message,
          durationMs,
          error: error.message,
          interrupted: false,
          startedAt: startTimestamp,
          endedAt: endTimestamp,
        };

        this.currentProcess = undefined;
        resolve(result);
        options?.onEnd?.(result);
      });

      // Call onStart callback
      options?.onStart?.(executionId);
    });

    const handle: AgentExecutionHandle = {
      executionId,
      promise: executionPromise,
      interrupt: () => {
        if (this.currentProcess && !this.currentProcess.killed) {
          this.currentProcess.kill('SIGINT');
        }
      },
      isRunning: () => this.currentProcess !== undefined && !this.currentProcess.killed,
    };

    return handle;
  }

  /**
   * Get setup questions for configuring iFlow.
   */
  override getSetupQuestions(): AgentSetupQuestion[] {
    return [
      {
        id: 'iflowPath',
        prompt: 'Path to iFlow executable (leave empty to auto-detect from PATH):',
        type: 'path',
        required: false,
        help: 'If iFlow is not in your PATH, specify the full path to the executable.',
      },
      {
        id: 'defaultFlags',
        prompt: 'Default iFlow CLI flags (space-separated):',
        type: 'text',
        required: false,
        help: 'Additional flags to pass to iFlow by default (e.g., "--model gpt-4 --temperature 0.7").',
      },
    ];
  }

  /**
   * Validate iFlow configuration.
   */
  override async validateSetup(answers: Record<string, unknown>): Promise<string | null> {
    const iflowPath = answers.iflowPath as string;
    
    if (iflowPath && iflowPath.trim()) {
      try {
        await execAsync(`"${iflowPath}" --version`);
      } catch {
        return `Cannot execute iFlow at path: ${iflowPath}. Please check the path is correct.`;
      }
    }
    
    return null;
  }

  /**
   * Validate model name for iFlow.
   */
  override validateModel(_model: string): string | null {
    // iFlow supports various models, no strict validation needed
    return null;
  }

  /**
   * Run preflight check for iFlow.
   */
  override async preflight(options?: { timeout?: number }): Promise<AgentPreflightResult> {
    const startTime = Date.now();
    
    try {
      const testPrompt = 'Say "Hello from iFlow"';
      const handle = this.execute(testPrompt, [], {
        timeout: options?.timeout || 30000,
      });
      
      const result = await handle.promise;
      const durationMs = Date.now() - startTime;
      
      if (result.status === 'completed' && result.stdout.includes('Hello from iFlow')) {
        return {
          success: true,
          durationMs,
          stdout: result.stdout,
          stderr: result.stderr,
        };
      } else {
        return {
          success: false,
          error: result.error || 'iFlow did not respond as expected',
          suggestion: 'Check iFlow installation and configuration',
          durationMs,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        suggestion: 'Verify iFlow installation and check for network connectivity',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Clean up resources.
   */
  override async dispose(): Promise<void> {
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = undefined;
    }
    await super.dispose();
  }
}

/**
 * Factory function for creating iFlow agent plugin instances.
 */
const createIFlowAgent: import('../types.js').AgentPluginFactory = () => new IFlowAgentPlugin();

export default createIFlowAgent;
