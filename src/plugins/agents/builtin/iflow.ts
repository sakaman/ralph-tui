/**
 * ABOUTME: iFlow CLI Agent plugin for Ralph TUI.
 * Integrates with the iFlow CLI agent for AI-assisted development.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseAgentPlugin } from '../base.js';
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

/**
 * iFlow CLI Agent plugin implementation.
 */
export class IFlowAgentPlugin extends BaseAgentPlugin {
  constructor() {
    const meta: AgentPluginMeta = {
      id: 'iflow',
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
    super(meta);
  }

  /**
   * Initialize the plugin with configuration.
   */
  async initialize(config: Record<string, unknown>): Promise<void> {
    // iFlow-specific configuration can be added here
    await super.initialize(config);
  }

  /**
   * Detect if iFlow CLI is available on the system.
   */
  async detect(): Promise<AgentDetectResult> {
    try {
      const { stdout, stderr } = await execAsync('iflow --version', {
        timeout: 10000,
      });

      // Extract version from output
      const versionMatch = stdout.match(/iflow\s+v?(\d+\.\d+\.\d+)/i) ||
                          stderr.match(/iflow\s+v?(\d+\.\d+\.\d+)/i);

      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        available: true,
        version,
        executablePath: 'iflow', // Assume it's in PATH
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute iFlow CLI with the given prompt.
   */
  execute(
    prompt: string,
    files?: import('../types.js').AgentFileContext[],
    options?: AgentExecuteOptions
  ): AgentExecutionHandle {
    const executionId = this.generateExecutionId();
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

    // Add any additional flags
    if (options?.flags) {
      args.push(...options.flags);
    }

    // Add the prompt as the final argument
    args.push('--prompt', prompt);

    const command = `iflow ${args.join(' ')}`;
    const cwd = options?.cwd || process.cwd();

    // Set up environment variables
    const env = { ...process.env, ...options?.env };

    // Start the execution
    const childProcess = exec(command, { cwd, env });
    const executionPromise = new Promise<AgentExecutionResult>((resolve) => {
      let stdout = '';
      let stderr = '';

      // Handle stdout streaming
      childProcess.stdout?.on('data', (data: string) => {
        stdout += data;
        options?.onStdout?.(data);
      });

      // Handle stderr streaming
      childProcess.stderr?.on('data', (data: string) => {
        stderr += data;
        options?.onStderr?.(data);
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
        childProcess.kill('SIGINT');
      },
      isRunning: () => !childProcess.killed,
    };

    // Store the execution
    this.currentExecution = handle;

    return handle;
  }

  /**
   * Get setup questions for configuring iFlow.
   */
  getSetupQuestions(): AgentSetupQuestion[] {
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
  async validateSetup(answers: Record<string, unknown>): Promise<string | null> {
    const iflowPath = answers.iflowPath as string;
    
    if (iflowPath && iflowPath.trim()) {
      try {
        // Test if the specified path exists and is executable
        await execAsync(`"${iflowPath}" --version`);
      } catch (error) {
        return `Cannot execute iFlow at path: ${iflowPath}. Please check the path is correct.`;
      }
    }
    
    return null;
  }

  /**
   * Validate model name for iFlow.
   */
  validateModel(model: string): string | null {
    // iFlow supports various models, no strict validation needed
    return null;
  }

  /**
   * Run preflight check for iFlow.
   */
  async preflight(options?: { timeout?: number }): Promise<AgentPreflightResult> {
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
}

/**
 * Factory function for creating iFlow agent plugin instances.
 */
export default function createIFlowAgent(): IFlowAgentPlugin {
  return new IFlowAgentPlugin();
}