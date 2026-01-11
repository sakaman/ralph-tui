/**
 * ABOUTME: Template engine for prompt rendering using Handlebars.
 * Handles loading templates (custom or built-in) and rendering with task context.
 */

import Handlebars from 'handlebars';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TrackerTask } from '../plugins/trackers/types.js';
import type { RalphConfig } from '../config/types.js';
import type {
  TemplateVariables,
  TemplateContext,
  TemplateLoadResult,
  TemplateRenderResult,
  BuiltinTemplateType,
} from './types.js';
import {
  DEFAULT_TEMPLATE,
  BEADS_TEMPLATE,
  BEADS_BV_TEMPLATE,
  JSON_TEMPLATE,
} from './builtin.js';

/**
 * Cache for compiled templates to avoid recompilation
 */
const templateCache = new Map<string, Handlebars.TemplateDelegate>();

/**
 * Get the built-in template content for a tracker type.
 * @param trackerType The tracker type (plugin name)
 * @returns The template content
 */
export function getBuiltinTemplate(trackerType: BuiltinTemplateType): string {
  switch (trackerType) {
    case 'beads':
      return BEADS_TEMPLATE;
    case 'beads-bv':
      return BEADS_BV_TEMPLATE;
    case 'json':
      return JSON_TEMPLATE;
    case 'default':
    default:
      return DEFAULT_TEMPLATE;
  }
}

/**
 * Get the built-in template type from a tracker plugin name.
 * @param pluginName The tracker plugin name
 * @returns The matching built-in template type
 */
export function getTemplateTypeFromPlugin(pluginName: string): BuiltinTemplateType {
  if (pluginName.includes('beads-bv')) {
    return 'beads-bv';
  }
  if (pluginName.includes('beads')) {
    return 'beads';
  }
  if (pluginName.includes('json')) {
    return 'json';
  }
  return 'default';
}

/**
 * Load a template from a custom path or fall back to built-in.
 * @param customPath Optional path to custom template
 * @param trackerType Tracker type for built-in template fallback
 * @param cwd Working directory for relative path resolution
 * @returns The template load result
 */
export function loadTemplate(
  customPath: string | undefined,
  trackerType: BuiltinTemplateType,
  cwd: string
): TemplateLoadResult {
  // Try custom template first
  if (customPath) {
    const resolvedPath = path.isAbsolute(customPath)
      ? customPath
      : path.resolve(cwd, customPath);

    try {
      if (fs.existsSync(resolvedPath)) {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        return {
          success: true,
          content,
          source: resolvedPath,
        };
      } else {
        return {
          success: false,
          source: resolvedPath,
          error: `Template file not found: ${resolvedPath}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        source: resolvedPath,
        error: `Failed to read template: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Use built-in template
  const content = getBuiltinTemplate(trackerType);
  return {
    success: true,
    content,
    source: `builtin:${trackerType}`,
  };
}

/**
 * Extract acceptance criteria from a description.
 * Looks for markdown patterns like "## Acceptance Criteria" or checklist items.
 * @param description The full task description
 * @returns Extracted acceptance criteria or empty string
 */
function extractAcceptanceCriteria(description: string | undefined): string {
  if (!description) return '';

  // Look for explicit "Acceptance Criteria" section
  const acMatch = description.match(/##\s*Acceptance\s*Criteria[\s\S]*?(?=##|$)/i);
  if (acMatch) {
    return acMatch[0].replace(/##\s*Acceptance\s*Criteria\s*/i, '').trim();
  }

  // Look for checklist patterns
  const checklistLines = description.split('\n').filter(
    (line) => /^[-*]\s*\[[\sx]\]/.test(line.trim())
  );
  if (checklistLines.length > 0) {
    return checklistLines.join('\n');
  }

  return '';
}

/**
 * Build template variables from task and config.
 * @param task The current task
 * @param config The ralph configuration
 * @param epic Optional epic information
 * @returns The flattened template variables
 */
export function buildTemplateVariables(
  task: TrackerTask,
  config: Partial<RalphConfig>,
  epic?: { id: string; title: string; description?: string }
): TemplateVariables {
  return {
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description ?? '',
    acceptanceCriteria: extractAcceptanceCriteria(task.description),
    epicId: epic?.id ?? task.parentId ?? '',
    epicTitle: epic?.title ?? '',
    trackerName: config.tracker?.plugin ?? 'unknown',
    labels: task.labels?.join(', ') ?? '',
    priority: String(task.priority ?? 2),
    status: task.status,
    dependsOn: task.dependsOn?.join(', ') ?? '',
    blocks: task.blocks?.join(', ') ?? '',
    type: task.type ?? '',
    model: config.model ?? '',
    agentName: config.agent?.plugin ?? 'unknown',
    cwd: config.cwd ?? process.cwd(),
    currentDate: new Date().toISOString().split('T')[0],
    currentTimestamp: new Date().toISOString(),
  };
}

/**
 * Build full template context for rendering.
 * @param task The current task
 * @param config The ralph configuration
 * @param epic Optional epic information
 * @returns The template context
 */
export function buildTemplateContext(
  task: TrackerTask,
  config: Partial<RalphConfig>,
  epic?: { id: string; title: string; description?: string }
): TemplateContext {
  return {
    vars: buildTemplateVariables(task, config, epic),
    task,
    config,
    epic,
  };
}

/**
 * Compile a template (with caching).
 * @param templateContent The template source
 * @param source The template source identifier for caching
 * @returns The compiled template function
 */
function compileTemplate(
  templateContent: string,
  source: string
): Handlebars.TemplateDelegate {
  // Check cache
  const cached = templateCache.get(source);
  if (cached) {
    return cached;
  }

  // Compile and cache
  const compiled = Handlebars.compile(templateContent, {
    noEscape: true, // Don't escape HTML entities in output
    strict: false, // Don't throw on missing variables
  });
  templateCache.set(source, compiled);
  return compiled;
}

/**
 * Render a prompt from a template and task context.
 * @param task The current task
 * @param config The ralph configuration
 * @param epic Optional epic information
 * @returns The render result with the prompt or error
 */
export function renderPrompt(
  task: TrackerTask,
  config: RalphConfig,
  epic?: { id: string; title: string; description?: string }
): TemplateRenderResult {
  // Determine template to use
  const trackerType = getTemplateTypeFromPlugin(config.tracker.plugin);
  const customPath = config.promptTemplate;

  // Load the template
  const loadResult = loadTemplate(customPath, trackerType, config.cwd);
  if (!loadResult.success || !loadResult.content) {
    return {
      success: false,
      error: loadResult.error ?? 'Failed to load template',
      source: loadResult.source,
    };
  }

  // Build context
  const context = buildTemplateContext(task, config, epic);

  // Create a flat context for Handlebars (variables at top level)
  const flatContext = {
    ...context.vars,
    task: context.task,
    config: context.config,
    epic: context.epic,
  };

  try {
    // Compile and render
    const template = compileTemplate(loadResult.content, loadResult.source);
    const prompt = template(flatContext);

    return {
      success: true,
      prompt: prompt.trim(),
      source: loadResult.source,
    };
  } catch (error) {
    return {
      success: false,
      error: `Template rendering failed: ${error instanceof Error ? error.message : String(error)}`,
      source: loadResult.source,
    };
  }
}

/**
 * Clear the template cache (useful for testing or when templates change).
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}

/**
 * Get the path where a custom template should be written for initialization.
 * @param cwd The working directory
 * @param filename Optional custom filename (default: 'ralph-prompt.hbs')
 * @returns The full path for the custom template
 */
export function getCustomTemplatePath(cwd: string, filename = 'ralph-prompt.hbs'): string {
  return path.join(cwd, filename);
}

/**
 * Copy a built-in template to a custom location for customization.
 * @param trackerType The built-in template type to copy
 * @param destPath The destination path
 * @returns Success status and any error message
 */
export function copyBuiltinTemplate(
  trackerType: BuiltinTemplateType,
  destPath: string
): { success: boolean; error?: string } {
  try {
    const content = getBuiltinTemplate(trackerType);

    // Ensure directory exists
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write template
    fs.writeFileSync(destPath, content, 'utf-8');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to copy template: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
