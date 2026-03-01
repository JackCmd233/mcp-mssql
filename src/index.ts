#!/usr/bin/env node

import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// 导入数据库工具模块
import {initDatabase, closeDatabase, getDatabaseMetadata} from './db/index.js';

// 导入处理器
import {handleListResources, handleReadResource} from './handlers/resourceHandlers.js';
import {handleListTools, handleToolCall} from './handlers/toolHandlers.js';

// 设置使用 stderr 而不是 stdout 的日志记录器,避免干扰 MCP 通信
const logger = {
    log: (...args: any[]) => console.error('[INFO]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
    warn: (...args: any[]) => console.error('[WARN]', ...args),
    info: (...args: any[]) => console.error('[INFO]', ...args),
};

// 配置服务器
const server = new Server(
    {
        name: "executeautomation/database-server",
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
    logger.error("请提供数据库连接信息");
    logger.error("SQLite 用法: node index.js <database_file_path>");
    logger.error("SQL Server 用法: node index.js --sqlserver --server <server> --database <database> [--user <user> --password <password>]");
    logger.error("PostgreSQL 用法: node index.js --postgresql --host <host> --database <database> [--user <user> --password <password> --port <port>]");
    logger.error("MySQL 用法: node index.js --mysql --host <host> --database <database> [--user <user> --password <password> --port <port>]");
    logger.error("MySQL with AWS IAM 用法: node index.js --mysql --aws-iam-auth --host <rds-endpoint> --database <database> --user <aws-username> --aws-region <region>");
    process.exit(1);
}

// 解析参数以确定数据库类型和连接信息
let dbType = 'sqlite';
let connectionInfo: any = null;

// 检查是否使用 SQL Server
if (args.includes('--sqlserver')) {
    dbType = 'sqlserver';
    connectionInfo = {
        server: '',
        database: '',
        user: undefined,
        password: undefined
    };

    // 解析 SQL Server 连接参数
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--server' && i + 1 < args.length) {
            connectionInfo.server = args[i + 1];
        } else if (args[i] === '--database' && i + 1 < args.length) {
            connectionInfo.database = args[i + 1];
        } else if (args[i] === '--user' && i + 1 < args.length) {
            connectionInfo.user = args[i + 1];
        } else if (args[i] === '--password' && i + 1 < args.length) {
            connectionInfo.password = args[i + 1];
        } else if (args[i] === '--port' && i + 1 < args.length) {
            connectionInfo.port = parseInt(args[i + 1], 10);
        }
    }

    // 验证 SQL Server 连接信息
    if (!connectionInfo.server || !connectionInfo.database) {
        logger.error("错误: SQL Server 需要 --server 和 --database 参数");
        process.exit(1);
    }
}
// 检查是否使用 PostgreSQL
else if (args.includes('--postgresql') || args.includes('--postgres')) {
    dbType = 'postgresql';
    connectionInfo = {
        host: '',
        database: '',
        user: undefined,
        password: undefined,
        port: undefined,
        ssl: undefined,
        connectionTimeout: undefined
    };

    // 解析 PostgreSQL 连接参数
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--host' && i + 1 < args.length) {
            connectionInfo.host = args[i + 1];
        } else if (args[i] === '--database' && i + 1 < args.length) {
            connectionInfo.database = args[i + 1];
        } else if (args[i] === '--user' && i + 1 < args.length) {
            connectionInfo.user = args[i + 1];
        } else if (args[i] === '--password' && i + 1 < args.length) {
            connectionInfo.password = args[i + 1];
        } else if (args[i] === '--port' && i + 1 < args.length) {
            connectionInfo.port = parseInt(args[i + 1], 10);
        } else if (args[i] === '--ssl' && i + 1 < args.length) {
            connectionInfo.ssl = args[i + 1] === 'true';
        } else if (args[i] === '--connection-timeout' && i + 1 < args.length) {
            connectionInfo.connectionTimeout = parseInt(args[i + 1], 10);
        }
    }

    // 验证 PostgreSQL 连接信息
    if (!connectionInfo.host || !connectionInfo.database) {
        logger.error("错误: PostgreSQL 需要 --host 和 --database 参数");
        process.exit(1);
    }
}
// 检查是否使用 MySQL
else if (args.includes('--mysql')) {
    dbType = 'mysql';
    connectionInfo = {
        host: '',
        database: '',
        user: undefined,
        password: undefined,
        port: undefined,
        ssl: undefined,
        connectionTimeout: undefined,
        awsIamAuth: false,
        awsRegion: undefined
    };
    // 解析 MySQL 连接参数
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--host' && i + 1 < args.length) {
            connectionInfo.host = args[i + 1];
        } else if (args[i] === '--database' && i + 1 < args.length) {
            connectionInfo.database = args[i + 1];
        } else if (args[i] === '--user' && i + 1 < args.length) {
            connectionInfo.user = args[i + 1];
        } else if (args[i] === '--password' && i + 1 < args.length) {
            connectionInfo.password = args[i + 1];
        } else if (args[i] === '--port' && i + 1 < args.length) {
            connectionInfo.port = parseInt(args[i + 1], 10);
        } else if (args[i] === '--ssl' && i + 1 < args.length) {
            const sslVal = args[i + 1];
            if (sslVal === 'true') connectionInfo.ssl = true;
            else if (sslVal === 'false') connectionInfo.ssl = false;
            else connectionInfo.ssl = sslVal;
        } else if (args[i] === '--connection-timeout' && i + 1 < args.length) {
            connectionInfo.connectionTimeout = parseInt(args[i + 1], 10);
        } else if (args[i] === '--aws-iam-auth') {
            connectionInfo.awsIamAuth = true;
        } else if (args[i] === '--aws-region' && i + 1 < args.length) {
            connectionInfo.awsRegion = args[i + 1];
        }
    }
    // 验证 MySQL 连接信息
    if (!connectionInfo.host || !connectionInfo.database) {
        logger.error("错误: MySQL 需要 --host 和 --database 参数");
        process.exit(1);
    }

    // AWS IAM 认证的额外验证
    if (connectionInfo.awsIamAuth) {
        if (!connectionInfo.user) {
            logger.error("错误: AWS IAM 认证需要 --user 参数");
            process.exit(1);
        }
        if (!connectionInfo.awsRegion) {
            logger.error("错误: AWS IAM 认证需要 --aws-region 参数");
            process.exit(1);
        }
        // 为 AWS IAM 认证自动启用 SSL (必需)
        connectionInfo.ssl = true;
        logger.info("AWS IAM 认证已启用 - SSL 已自动配置");
    }
} else {
    // SQLite 模式(默认)
    dbType = 'sqlite';
    connectionInfo = args[0]; // 第一个参数是 SQLite 文件路径
    logger.info(`Using SQLite database at path: ${connectionInfo}`);
}

// 设置请求处理器
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return await handleListResources();
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return await handleReadResource(request.params.uri);
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return handleListTools();
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await handleToolCall(request.params.name, request.params.arguments);
});

// 优雅处理关闭信号
process.on('SIGINT', async () => {
    logger.info('正在优雅关闭...');
    await closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('正在优雅关闭...');
    await closeDatabase();
    process.exit(0);
});

// 添加全局错误处理器
process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的 Promise 拒绝:', promise, '原因:', reason);
});

/**
 * 启动服务器
 */
async function runServer() {
    try {
        logger.info(`Initializing ${dbType} database...`);
        if (dbType === 'sqlite') {
            logger.info(`Database path: ${connectionInfo}`);
        } else if (dbType === 'sqlserver') {
            logger.info(`Server: ${connectionInfo.server}, Database: ${connectionInfo.database}`);
        } else if (dbType === 'postgresql') {
            logger.info(`Host: ${connectionInfo.host}, Database: ${connectionInfo.database}`);
        } else if (dbType === 'mysql') {
            logger.info(`Host: ${connectionInfo.host}, Database: ${connectionInfo.database}`);
        }

        // 初始化数据库
        await initDatabase(connectionInfo, dbType);

        const dbInfo = getDatabaseMetadata();
        logger.info(`Connected to ${dbInfo.name} database`);

        logger.info('Starting MCP server...');
        const transport = new StdioServerTransport();
        await server.connect(transport);

        logger.info('Server running. Press Ctrl+C to exit.');
    } catch (error) {
        logger.error("初始化失败:", error);
        process.exit(1);
    }
}

// 启动服务器
runServer().catch(error => {
    logger.error("服务器初始化失败:", error);
    process.exit(1);
}); 