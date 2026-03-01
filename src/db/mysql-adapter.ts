import {DbAdapter} from "./adapter.js";
import mysql from "mysql2/promise";
import {Signer} from "@aws-sdk/rds-signer";

/**
 * MySQL 数据库适配器实现
 */
export class MysqlAdapter implements DbAdapter {
    private connection: mysql.Connection | null = null;
    private config: mysql.ConnectionOptions;
    private host: string;
    private database: string;
    private awsIamAuth: boolean;
    private awsRegion?: string;

    constructor(connectionInfo: {
        host: string;
        database: string;
        user?: string;
        password?: string;
        port?: number;
        ssl?: boolean | object;
        connectionTimeout?: number;
        awsIamAuth?: boolean;
        awsRegion?: string;
    }) {
        this.host = connectionInfo.host;
        this.database = connectionInfo.database;
        this.awsIamAuth = connectionInfo.awsIamAuth || false;
        this.awsRegion = connectionInfo.awsRegion;
        this.config = {
            host: connectionInfo.host,
            database: connectionInfo.database,
            port: connectionInfo.port || 3306,
            user: connectionInfo.user,
            password: connectionInfo.password,
            connectTimeout: connectionInfo.connectionTimeout || 30000,
            multipleStatements: true,
        };
        if (typeof connectionInfo.ssl === 'object' || typeof connectionInfo.ssl === 'string') {
            this.config.ssl = connectionInfo.ssl;
        } else if (connectionInfo.ssl === true) {
            // 对于 AWS IAM 认证,为 RDS 适当配置 SSL
            if (this.awsIamAuth) {
                this.config.ssl = {
                    rejectUnauthorized: false // AWS RDS 处理证书验证
                };
            } else {
                this.config.ssl = {};
            }
        }
        // 验证端口号
        if (connectionInfo.port && typeof connectionInfo.port !== 'number') {
            const parsedPort = parseInt(connectionInfo.port as any, 10);
            if (isNaN(parsedPort)) {
                throw new Error(`无效的 MySQL 端口号: ${connectionInfo.port}`);
            }
            this.config.port = parsedPort;
        }
        // 记录端口用于调试
        console.error(`[DEBUG] MySQL connection will use port: ${this.config.port}`);
    }

    /**
     * 生成 AWS RDS 认证令牌
     */
    private async generateAwsAuthToken(): Promise<string> {
        if (!this.awsRegion) {
            throw new Error("AWS IAM 认证需要 AWS 区域参数");
        }

        if (!this.config.user) {
            throw new Error("AWS IAM 认证需要 AWS 用户名参数");
        }

        try {
            console.info(`[INFO] 正在为区域 ${this.awsRegion} 生成 AWS 认证令牌, 主机: ${this.host}, 用户: ${this.config.user}`);

            const signer = new Signer({
                region: this.awsRegion,
                hostname: this.host,
                port: this.config.port || 3306,
                username: this.config.user,
            });

            const token = await signer.getAuthToken();
            console.info(`[INFO] AWS 认证令牌生成成功`);
            return token;
        } catch (err) {
            console.error(`[ERROR] 生成 AWS 认证令牌失败: ${(err as Error).message}`);
            throw new Error(`AWS IAM 认证失败: ${(err as Error).message}。请检查您的 AWS 凭据和 IAM 权限。`);
        }
    }

    /**
     * 初始化 MySQL 连接
     */
    async init(): Promise<void> {
        try {
            console.info(`[INFO] 正在连接 MySQL: ${this.host}, 数据库: ${this.database}`);

            // 处理 AWS IAM 认证
            if (this.awsIamAuth) {
                console.info(`[INFO] 正在为用户 ${this.config.user} 使用 AWS IAM 认证`);

                try {
                    const authToken = await this.generateAwsAuthToken();

                    // 使用生成的令牌作为密码创建新配置
                    const awsConfig = {
                        ...this.config,
                        password: authToken
                    };

                    this.connection = await mysql.createConnection(awsConfig);
                } catch (err) {
                    console.error(`[ERROR] AWS IAM 认证失败: ${(err as Error).message}`);
                    throw new Error(`AWS IAM 认证失败: ${(err as Error).message}`);
                }
            } else {
                this.connection = await mysql.createConnection(this.config);
            }

            console.info(`[INFO] MySQL 连接成功建立`);
        } catch (err) {
            console.error(`[ERROR] MySQL 连接错误: ${(err as Error).message}`);
            if (this.awsIamAuth) {
                throw new Error(`使用 AWS IAM 认证连接 MySQL 失败: ${(err as Error).message}。请验证您的 AWS 凭据、IAM 权限和 RDS 配置。`);
            } else {
                throw new Error(`连接 MySQL 失败: ${(err as Error).message}`);
            }
        }
    }

    /**
     * 执行 SQL 查询并获取所有结果
     */
    async all(query: string, params: any[] = []): Promise<any[]> {
        if (!this.connection) {
            throw new Error("数据库未初始化");
        }
        try {
            const [rows] = await this.connection.execute(query, params);
            return Array.isArray(rows) ? rows : [];
        } catch (err) {
            throw new Error(`MySQL 查询错误: ${(err as Error).message}`);
        }
    }

    /**
     * 执行修改数据的 SQL 查询
     */
    async run(query: string, params: any[] = []): Promise<{ changes: number, lastID: number }> {
        if (!this.connection) {
            throw new Error("数据库未初始化");
        }
        try {
            const [result]: any = await this.connection.execute(query, params);
            const changes = result.affectedRows || 0;
            const lastID = result.insertId || 0;
            return {changes, lastID};
        } catch (err) {
            throw new Error(`MySQL 查询错误: ${(err as Error).message}`);
        }
    }

    /**
     * 执行多条 SQL 语句
     */
    async exec(query: string): Promise<void> {
        if (!this.connection) {
            throw new Error("数据库未初始化");
        }
        try {
            await this.connection.query(query);
        } catch (err) {
            throw new Error(`MySQL 批处理错误: ${(err as Error).message}`);
        }
    }

    /**
     * 关闭数据库连接
     */
    async close(): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }

    /**
     * 获取数据库元数据
     */
    getMetadata(): { name: string; type: string; server: string; database: string } {
        return {
            name: "MySQL",
            type: "mysql",
            server: this.host,
            database: this.database,
        };
    }

    /**
     * 获取列出表的数据库特定查询
     */
    getListTablesQuery(): string {
        return `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = '${this.database}'`;
    }

    /**
     * 获取描述表的数据库特定查询
     */
    getDescribeTableQuery(tableName: string): string {
        // MySQL DESCRIBE 返回具有不同名称的列,因此我们使用与预期格式匹配的查询
        return `
      SELECT
        COLUMN_NAME as name,
        DATA_TYPE as type,
        CASE WHEN IS_NULLABLE = 'NO' THEN 1 ELSE 0 END as notnull,
        CASE WHEN COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END as pk,
        COLUMN_DEFAULT as dflt_value,
        COLUMN_COMMENT as comment
      FROM
        INFORMATION_SCHEMA.COLUMNS
      WHERE
        TABLE_NAME = '${tableName}'
        AND TABLE_SCHEMA = '${this.database}'
      ORDER BY
        ORDINAL_POSITION
    `;
    }
} 