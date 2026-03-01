#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import sqlite3 from "sqlite3";

// 配置服务器
const server = new Server(
  {
    name: "@cmd233/mcp-mssql",
    version: "1.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

// 解析命令行参数
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Please provide a database file path as a command-line argument");
  process.exit(1);
}

const databasePath = args[0];

// 创建 SQLite 资源基础 URL
const resourceBaseUrl = new URL(`sqlite:///${databasePath}`);
const SCHEMA_PATH = "schema";

// 初始化 SQLite 数据库连接
let db: sqlite3.Database;

function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(databasePath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// 辅助函数：执行查询并获取所有结果
function dbAll(query: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err: Error | null, rows: any[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// 辅助函数：执行不返回结果的查询
function dbRun(query: string, params: any[] = []): Promise<{ changes: number, lastID: number }> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes, lastID: this.lastID });
      }
    });
  });
}

// 辅助函数：执行多条语句
function dbExec(query: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(query, (err: Error | null) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// 列出所有可用的数据库资源（表）
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  // Query to get all table names
  const result = await dbAll(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  
  return {
    resources: result.map((row) => ({
      uri: new URL(`${row.name}/${SCHEMA_PATH}`, resourceBaseUrl).href,
      mimeType: "application/json",
      name: `"${row.name}" database schema`,
    })),
  };
});

// 获取特定表的架构信息
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);

  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const tableName = pathComponents.pop();

  if (schema !== SCHEMA_PATH) {
    throw new Error("Invalid resource URI");
  }

  // 查询表的列信息
  const result = await dbAll(`PRAGMA table_info("${tableName}")`);

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(result.map((column) => ({
          column_name: column.name,
          data_type: column.type
        })), null, 2),
      },
    ],
  };
});

// 列出可用的工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_query",
        description: "Execute SELECT queries to read data from the database",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
      {
        name: "write_query",
        description: "Execute INSERT, UPDATE, or DELETE queries",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
      {
        name: "create_table",
        description: "Create new tables in the database",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
      {
        name: "alter_table",
        description: "Modify existing table schema (add columns, rename tables, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
      {
        name: "drop_table",
        description: "Remove a table from the database with safety confirmation",
        inputSchema: {
          type: "object",
          properties: {
            table_name: { type: "string" },
            confirm: { type: "boolean" },
          },
          required: ["table_name", "confirm"],
        },
      },
      {
        name: "export_query",
        description: "Export query results to various formats (CSV, JSON)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            format: { type: "string", enum: ["csv", "json"] },
          },
          required: ["query", "format"],
        },
      },
      {
        name: "list_tables",
        description: "Get a list of all tables in the database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "describe_table",
        description: "View schema information for a specific table",
        inputSchema: {
          type: "object",
          properties: {
            table_name: { type: "string" },
          },
          required: ["table_name"],
        },
      },
      {
        name: "append_insight",
        description: "Add a business insight to the memo",
        inputSchema: {
          type: "object",
          properties: {
            insight: { type: "string" },
          },
          required: ["insight"],
        },
      },
    ],
  };
});

// 辅助函数：将数据转换为 CSV 格式
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';
  
  // 获取表头
  const headers = Object.keys(data[0]);
  
  // 创建 CSV 表头行
  let csv = headers.join(',') + '\n';
  
  // 添加数据行
  data.forEach(row => {
    const values = headers.map(header => {
      const val = row[header];
      // 处理包含逗号、引号等的字符串
      if (typeof val === 'string') {
        return `"${val.replace(/"/g, '""')}"`;
      }
      // null/undefined 使用空字符串
      return val === null || val === undefined ? '' : val;
    });
    csv += values.join(',') + '\n';
  });
  
  return csv;
}

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "read_query": {
      const query = request.params.arguments?.query as string;
      
      if (!query.trim().toLowerCase().startsWith("select")) {
        throw new Error("Only SELECT queries are allowed with read_query");
      }

      try {
        const result = await dbAll(query);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false,
        };
      } catch (error: any) {
        throw new Error(`SQL Error: ${error.message}`);
      }
    }

    case "write_query": {
      const query = request.params.arguments?.query as string;
      const lowerQuery = query.trim().toLowerCase();
      
      if (lowerQuery.startsWith("select")) {
        throw new Error("Use read_query for SELECT operations");
      }
      
      if (!(lowerQuery.startsWith("insert") || lowerQuery.startsWith("update") || lowerQuery.startsWith("delete"))) {
        throw new Error("Only INSERT, UPDATE, or DELETE operations are allowed with write_query");
      }

      try {
        const result = await dbRun(query);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ affected_rows: result.changes }, null, 2) 
          }],
          isError: false,
        };
      } catch (error: any) {
        throw new Error(`SQL Error: ${error.message}`);
      }
    }

    case "create_table": {
      const query = request.params.arguments?.query as string;
      
      if (!query.trim().toLowerCase().startsWith("create table")) {
        throw new Error("Only CREATE TABLE statements are allowed");
      }

      try {
        await dbExec(query);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ success: true, message: "Table created successfully" }, null, 2) 
          }],
          isError: false,
        };
      } catch (error: any) {
        throw new Error(`SQL Error: ${error.message}`);
      }
    }

    case "alter_table": {
      const query = request.params.arguments?.query as string;
      
      if (!query.trim().toLowerCase().startsWith("alter table")) {
        throw new Error("Only ALTER TABLE statements are allowed");
      }

      try {
        await dbExec(query);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ success: true, message: "Table altered successfully" }, null, 2) 
          }],
          isError: false,
        };
      } catch (error: any) {
        throw new Error(`SQL Error: ${error.message}`);
      }
    }

    case "drop_table": {
      const tableName = request.params.arguments?.table_name as string;
      const confirm = request.params.arguments?.confirm as boolean;
      
      if (!tableName) {
        throw new Error("Table name is required");
      }
      
      if (!confirm) {
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              success: false, 
              message: "Safety confirmation required. Set confirm=true to proceed with dropping the table." 
            }, null, 2) 
          }],
          isError: false,
        };
      }

      try {
        // 检查表是否存在
        const tableExists = await dbAll(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
          [tableName]
        );
        
        if (tableExists.length === 0) {
          throw new Error(`Table '${tableName}' does not exist`);
        }

        // 删除表
        await dbExec(`DROP TABLE "${tableName}"`);
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ success: true, message: `Table '${tableName}' dropped successfully` }, null, 2) 
          }],
          isError: false,
        };
      } catch (error: any) {
        throw new Error(`Error dropping table: ${error.message}`);
      }
    }

    case "export_query": {
      const query = request.params.arguments?.query as string;
      const format = request.params.arguments?.format as string;
      
      if (!query.trim().toLowerCase().startsWith("select")) {
        throw new Error("Only SELECT queries are allowed with export_query");
      }

      try {
        const result = await dbAll(query);
        
        if (format === "csv") {
          const csvData = convertToCSV(result);
          return {
            content: [{ 
              type: "text", 
              text: csvData
            }],
            isError: false,
          };
        } else if (format === "json") {
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify(result, null, 2) 
            }],
            isError: false,
          };
        } else {
          throw new Error("Unsupported export format. Use 'csv' or 'json'");
        }
      } catch (error: any) {
        throw new Error(`Export Error: ${error.message}`);
      }
    }

    case "list_tables": {
      try {
        const tables = await dbAll(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(tables.map((t) => t.name), null, 2) 
          }],
          isError: false,
        };
      } catch (error: any) {
        throw new Error(`Error listing tables: ${error.message}`);
      }
    }

    case "describe_table": {
      const tableName = request.params.arguments?.table_name as string;
      
      if (!tableName) {
        throw new Error("Table name is required");
      }

      try {
        // 检查表是否存在
        const tableExists = await dbAll(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
          [tableName]
        );
        
        if (tableExists.length === 0) {
          throw new Error(`Table '${tableName}' does not exist`);
        }
        
        const columns = await dbAll(`PRAGMA table_info("${tableName}")`);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(columns.map((col) => ({
              name: col.name,
              type: col.type,
              notnull: !!col.notnull,
              default_value: col.dflt_value,
              primary_key: !!col.pk
            })), null, 2) 
          }],
          isError: false,
        };
      } catch (error: any) {
        throw new Error(`Error describing table: ${error.message}`);
      }
    }
    
    case "append_insight": {
      const insight = request.params.arguments?.insight as string;
      
      if (!insight) {
        throw new Error("Insight text is required");
      }

      try {
        // 如果洞察表不存在则创建
        await dbExec(`
          CREATE TABLE IF NOT EXISTS mcp_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            insight TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // 插入洞察
        await dbRun(
          "INSERT INTO mcp_insights (insight) VALUES (?)",
          [insight]
        );
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ success: true, message: "Insight added" }, null, 2) 
          }],
          isError: false,
        };
      } catch (error: any) {
        throw new Error(`Error adding insight: ${error.message}`);
      }
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function runServer() {
  try {
    await initDatabase();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error("Failed to initialize:", error);
    process.exit(1);
  }
}

runServer().catch(console.error);