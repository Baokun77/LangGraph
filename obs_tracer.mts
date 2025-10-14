import Database from 'better-sqlite3';
import { encoding_for_model } from 'tiktoken';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface TraceData {
  run_id: string;
  agent_type: 'react' | 'tot' | 'reflect';
  step_idx: number;
  node_name: string;
  input_summary?: string;
  observation_summary?: string;
  tool_name?: string;
  latency_ms: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost_usd?: number;
  errors?: string;
}

export class ObsTracer {
  private db: Database.Database;
  private encoding: any;
  private runId: string;
  private stepCounter: number = 0;
  private tracesDir: string;

  // GPT-4o-mini pricing (Oct 2024)
  private readonly INPUT_COST_PER_1M = 0.15;
  private readonly OUTPUT_COST_PER_1M = 0.60;

  constructor() {
    this.runId = uuidv4();
    this.tracesDir = 'traces';
    
    // Create traces directory if it doesn't exist
    if (!existsSync(this.tracesDir)) {
      mkdirSync(this.tracesDir, { recursive: true });
    }

    // Initialize SQLite database
    this.db = new Database('traces.db');
    this.initializeDatabase();

    // Initialize tiktoken encoding
    this.encoding = encoding_for_model('gpt-4');
  }

  private initializeDatabase(): void {
    const createTable = `
      CREATE TABLE IF NOT EXISTS node_traces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        step_idx INTEGER NOT NULL,
        node_name TEXT NOT NULL,
        input_summary TEXT,
        observation_summary TEXT,
        tool_name TEXT,
        latency_ms REAL,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        cost_usd REAL,
        errors TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    this.db.exec(createTable);
  }

  public wrapNode<T extends any[], R>(
    nodeFn: (...args: T) => R,
    nodeName: string,
    agentType: 'react' | 'tot' | 'reflect'
  ): (...args: T) => R {
    return (...args: T): R => {
      const startTime = Date.now();
      this.stepCounter++;
      
      try {
        // Execute the original node function
        const result = nodeFn(...args);
        
        // Handle both sync and async results
        if (result && typeof result.then === 'function') {
          return result.then((resolvedResult: any) => {
            this.logNodeExecution(
              nodeName,
              agentType,
              args,
              resolvedResult,
              Date.now() - startTime
            );
            return resolvedResult;
          });
        } else {
          this.logNodeExecution(
            nodeName,
            agentType,
            args,
            result,
            Date.now() - startTime
          );
          return result;
        }
      } catch (error) {
        this.logNodeExecution(
          nodeName,
          agentType,
          args,
          null,
          Date.now() - startTime,
          error
        );
        throw error;
      }
    };
  }

  private logNodeExecution(
    nodeName: string,
    agentType: 'react' | 'tot' | 'reflect',
    input: any[],
    output: any,
    latencyMs: number,
    error?: any
  ): void {
    try {
      const inputSummary = this.truncateText(JSON.stringify(input), 200);
      const observationSummary = output ? this.truncateText(JSON.stringify(output), 200) : undefined;
      
      // Extract tool name from input if available
      const toolName = this.extractToolName(input);
      
      // Calculate token counts and cost
      const promptTokens = this.countTokens(inputSummary);
      const completionTokens = output ? this.countTokens(observationSummary || '') : 0;
      const costUsd = this.calculateCost(promptTokens, completionTokens);
      
      const traceData: TraceData = {
        run_id: this.runId,
        agent_type: agentType,
        step_idx: this.stepCounter,
        node_name: nodeName,
        input_summary: inputSummary,
        observation_summary: observationSummary,
        tool_name: toolName,
        latency_ms: latencyMs,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: costUsd,
        errors: error ? JSON.stringify(error.message || error) : undefined
      };

      // Write to database
      this.writeToDatabase(traceData);
      
      // Write to JSONL file
      this.writeToJsonl(traceData);
      
    } catch (logError) {
      console.error('Failed to log node execution:', logError);
    }
  }

  private truncateText(text: string, maxTokens: number): string {
    const tokens = this.encoding.encode(text);
    if (tokens.length <= maxTokens) {
      return text;
    }
    
    const truncatedTokens = tokens.slice(0, maxTokens);
    return this.encoding.decode(truncatedTokens);
  }

  private countTokens(text: string): number {
    return this.encoding.encode(text).length;
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    const inputCost = (promptTokens / 1000000) * this.INPUT_COST_PER_1M;
    const outputCost = (completionTokens / 1000000) * this.OUTPUT_COST_PER_1M;
    return inputCost + outputCost;
  }

  private extractToolName(input: any[]): string | undefined {
    // Try to extract tool name from input structure
    for (const arg of input) {
      if (typeof arg === 'object' && arg !== null) {
        // Look for common tool name patterns
        if (arg.tool_name) return arg.tool_name;
        if (arg.tool) return arg.tool;
        if (arg.name) return arg.name;
        
        // Check if it's a tool call object
        if (arg.tool_calls && arg.tool_calls.length > 0) {
          return arg.tool_calls[0].name;
        }
      }
    }
    return undefined;
  }

  private writeToDatabase(traceData: TraceData): void {
    const insert = this.db.prepare(`
      INSERT INTO node_traces (
        run_id, agent_type, step_idx, node_name, input_summary,
        observation_summary, tool_name, latency_ms, prompt_tokens,
        completion_tokens, cost_usd, errors
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insert.run(
      traceData.run_id,
      traceData.agent_type,
      traceData.step_idx,
      traceData.node_name,
      traceData.input_summary,
      traceData.observation_summary,
      traceData.tool_name,
      traceData.latency_ms,
      traceData.prompt_tokens,
      traceData.completion_tokens,
      traceData.cost_usd,
      traceData.errors
    );
  }

  private writeToJsonl(traceData: TraceData): void {
    const jsonlLine = JSON.stringify(traceData) + '\n';
    const filePath = join(this.tracesDir, `${this.runId}.jsonl`);
    
    try {
      writeFileSync(filePath, jsonlLine, { flag: 'a' });
    } catch (error) {
      console.error('Failed to write to JSONL file:', error);
    }
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
    if (this.encoding) {
      this.encoding.free();
    }
  }
}