import sqlite3 from "sqlite3";
import {DbAdapter} from "./adapter.js";

/**
 * SQLite 数据库适配器实现
 */
export class SqliteAdapter implements DbAdapter {
    private db: sqlite3.Database | null = null;
    private dbPath: string;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    /**
     * 初始化 SQLite 数据库连接
     */
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // 确保数据库路径可访问
            console.error(`[INFO] 正在打开 SQLite 数据库: ${this.dbPath}`);
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error(`[ERROR] SQLite 连接错误: ${err.message}`);
                    reject(err);
                } else {
                    console.error("[INFO] SQLite 数据库成功打开");
                    resolve();
                }
            });
        });
    }

    /**
     * 执行 SQL 查询并返回所有结果
     * @param query 要执行的 SQL 查询
     * @param params 查询参数
     * @returns 包含查询结果的 Promise
     */
    async all(query: string, params: any[] = []): Promise<any[]> {
        if (!this.db) {
            throw new Error("数据库未初始化");
        }

        return new Promise((resolve, reject) => {
            this.db!.all(query, params, (err: Error | null, rows: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * 执行修改数据的 SQL 查询
     * @param query 要执行的 SQL 查询
     * @param params 查询参数
     * @returns 包含结果信息的 Promise
     */
    async run(query: string, params: any[] = []): Promise<{ changes: number, lastID: number }> {
        if (!this.db) {
            throw new Error("数据库未初始化");
        }

        return new Promise((resolve, reject) => {
            this.db!.run(query, params, function (this: sqlite3.RunResult, err: Error | null) {
                if (err) {
                    reject(err);
                } else {
                    resolve({changes: this.changes, lastID: this.lastID});
                }
            });
        });
    }

    /**
     * 执行多条 SQL 语句
     * @param query 要执行的 SQL 语句
     * @returns 执行完成后完成的 Promise
     */
    async exec(query: string): Promise<void> {
        if (!this.db) {
            throw new Error("数据库未初始化");
        }

        return new Promise((resolve, reject) => {
            this.db!.exec(query, (err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 关闭数据库连接
     */
    async close(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }

            this.db.close((err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    this.db = null;
                    resolve();
                }
            });
        });
    }

    /**
     * 获取数据库元数据
     */
    getMetadata(): { name: string, type: string, path: string } {
        return {
            name: "SQLite",
            type: "sqlite",
            path: this.dbPath
        };
    }

    /**
     * 获取列出所有表的数据库特定查询
     */
    getListTablesQuery(): string {
        return "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    }

    /**
     * 获取描述表结构的数据库特定查询
     * @param tableName 表名
     */
    getDescribeTableQuery(tableName: string): string {
        return `SELECT name, type, notnull, pk, dflt_value, NULL as comment FROM pragma_table_info('${tableName}')`;
    }
} 