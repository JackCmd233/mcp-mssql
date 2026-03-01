# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

本文件为 Claude Code 提供项目指导。

**项目目的**: MCP 服务器项目，为 Claude Code 提供数据库访问能力。通过 MCP 协议，让 Claude AI 能够直接查询和操作 SQLite、SQL Server、PostgreSQL、MySQL 数据库。

## 系统要求

- Node.js 18+
- TypeScript 5.8+

## 核心架构

项目使用**适配器模式**实现多数据库支持:

```
src/index.ts (主入口)
    ↓
src/handlers/ (请求路由层)
    ↓
src/tools/ (工具实现层)
    ↓
src/db/index.ts (数据库管理层)
    ↓
src/db/adapter.ts (适配器接口层)
    ↓
具体适配器实现 (sqlite-adapter.ts, sqlserver-adapter.ts 等)
```

**层次说明**:
- `src/index.ts`: MCP 服务器主入口，处理命令行参数，初始化数据库连接
- `src/handlers/`: MCP 协议层的请求路由
- `src/tools/`: 具体工具实现，包含 SQL 验证和业务逻辑
- `src/db/index.ts`: 数据库管理层，提供统一 API (`dbAll`, `dbRun`, `dbExec`)，管理全局适配器实例
- `src/db/adapter.ts`: 定义 `DbAdapter` 接口和适配器工厂函数

## 关键文件路径

| 文件 | 说明 |
|------|------|
| `src/index.ts` | 主入口，参数解析 |
| `src/db/adapter.ts` | DbAdapter 接口定义 |
| `src/db/index.ts` | 数据库连接管理 |
| `src/db/*-adapter.ts` | 各数据库适配器实现 |
| `src/tools/*.ts` | MCP 工具实现 |
| `src/utils/*.ts` | 格式化等工具函数 |
| `src/handlers/*.ts` | MCP 请求处理 |

## 注意事项

**遗留文件**: 根目录的 `index.ts` 是旧的 SQLite-only 实现，请勿使用。当前入口为 `src/index.ts`。

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建项目 |
| `npm run prepare` | npm 发布前自动构建 |
| `npm run dev` | 开发模式 (构建+运行) |
| `npm run watch` | 监视模式 |
| `npm run clean` | 清理构建目录 |
| `npm run start` | 运行已构建的服务器 |

## 服务器启动方式

| 数据库 | 命令示例 |
|--------|----------|
| SQLite | `node dist/src/index.js /path/to/db.db` |
| SQL Server | `node dist/src/index.js --sqlserver --server <host> --database <db> [--user <user> --password <pwd>]` |
| PostgreSQL | `node dist/src/index.js --postgresql --host <host> --database <db> [--user <user> --password <pwd>]` |
| MySQL | `node dist/src/index.js --mysql --host <host> --database <db> [--user <user> --password <pwd>]` |
| MySQL AWS IAM | `node dist/src/index.js --mysql --aws-iam-auth --host <rds-endpoint> --database <db> --user <aws-user> --aws-region <region>` |

**特殊配置:**
- SQL Server：未提供用户名/密码时自动启用 Windows 集成认证
- MySQL AWS IAM：自动启用 SSL，需配置 AWS 凭据

## DbAdapter 接口

所有数据库适配器必须实现 `src/db/adapter.ts` 中定义的接口:

**必需方法:**
- `init()` - 初始化连接
- `close()` - 关闭连接
- `all(query, params?)` - 执行查询返回所有结果
- `run(query, params?)` - 执行修改操作
- `exec(query)` - 执行多条 SQL 语句
- `getMetadata()` - 获取数据库元数据
- `getListTablesQuery()` - 获取列出表的查询
- `getDescribeTableQuery(tableName)` - 获取表结构查询

**可选方法:**
- 视图支持: `getListViewsQuery?()`, `getViewDefinitionQuery?()`, `supportsViews?()`
- 存储过程支持: `getListProceduresQuery?()`, `getDescribeProcedureQuery?()`, `getProcedureDefinitionQuery?()`, `supportsProcedures?()`

## 数据库适配器差异

| 数据库 | 适配器文件 | 占位符 | 连接模式 |
|--------|------------|--------|----------|
| SQLite | `sqlite-adapter.ts` | `?` | 单连接 |
| SQL Server | `sqlserver-adapter.ts` | `@param0` | 连接池 + 自动重试 |
| PostgreSQL | `postgresql-adapter.ts` | `$1, $2` | 单连接 |
| MySQL | `mysql-adapter.ts` | `?` | 单连接 |

## 适配器实现要点

1. **参数占位符转换**: 在 `all()` 和 `run()` 方法中将通用的 `?` 占位符转换为目标数据库格式
2. **lastID 返回**: SQL Server 使用 `SCOPE_IDENTITY()`，PostgreSQL 使用 `RETURNING id`
3. **可空字段检测**: `notnull` 字段: 1=NOT NULL, 0=可空。SQL Server 的 `IS_NULLABLE` 返回 'YES'/'NO'，需反向映射
4. **模块导入**: 必须使用 `.js` 扩展名导入相对模块 (TypeScript 编译后要求)
5. **Windows 集成认证**: SQL Server 在未提供用户名/密码时自动启用 `trustedConnection`
6. **MySQL AWS IAM 认证**: 使用 `@aws-sdk/rds-signer` 生成临时令牌，自动启用 SSL

## 安全确认机制

数据修改工具（`write_query`、`create_table`、`alter_table`、`drop_table`、`append_insight`）需要 `confirm=true` 参数才能执行。未确认时返回提示消息，不执行操作。

## 代码风格约定

- 所有代码注释使用中文编写
- 函数和变量名使用英文
- 使用 `stderr` 而不是 `stdout` 进行日志记录，避免干扰 MCP 通信
- 所有数据库操作使用 `try-catch` 包装
- 所有适配器支持参数化查询以防止 SQL 注入

## Docker 部署

```bash
# 构建镜像
docker build -t mcp-mssql .

# 运行容器 (SQLite 示例)
docker run -i --rm -v /path/to/db.db:/data/db.db mcp-mssql /data/db.db
```

**注意**: Dockerfile 入口点路径需要修正为 `dist/src/index.js`。

## 调试技巧

查看服务器日志 (使用 stderr 输出):
```bash
# 运行服务器并查看日志
node dist/src/index.js /path/to/db.db 2> server.log

# 实时查看日志
node dist/src/index.js /path/to/db.db 2>&1 | tee server.log
```

## MCP 工具列表

| 工具 | 功能 |
|------|------|
| `read_query` | 执行 SELECT 查询 |
| `write_query` | 执行 INSERT/UPDATE/DELETE/TRUNCATE |
| `create_table` | 创建新表 |
| `alter_table` | 修改表结构 |
| `drop_table` | 删除表 |
| `list_tables` | 列出所有表 |
| `describe_table` | 获取表结构 |
| `export_query` | 导出查询结果 (CSV/JSON) |
| `append_insight` | 添加业务洞察 (仅 SQLite) |
| `list_insights` | 列出业务洞察 (仅 SQLite) |
| `list_views` | 列出视图 (仅 SQL Server) |
| `describe_view` | 获取视图结构 (仅 SQL Server) |
| `get_view_definition` | 获取视图定义 SQL (仅 SQL Server) |
| `list_procedures` | 列出存储过程 (仅 SQL Server) |
| `describe_procedure` | 获取存储过程参数 (仅 SQL Server) |
| `get_procedure_definition` | 获取存储过程定义 (仅 SQL Server) |

## 添加新数据库支持

1. 在 `src/db/` 下创建适配器文件实现 `DbAdapter` 接口
2. 在 `src/db/adapter.ts` 的 `createAdapter()` 中注册新类型
3. 在 `src/index.ts` 中添加命令行参数解析
4. 安装对应的数据库驱动包
