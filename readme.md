# MCP 数据库服务器

本 MCP (Model Context Protocol) 服务器为 Claude 提供数据库访问能力,支持 SQLite、SQL Server、PostgreSQL 和 MySQL 数据库。

## 安装

1. 克隆仓库:
```
git clone https://github.com/JackCmd233/mcp-mssql.git
cd mcp-mssql
```

2. 安装依赖:
```
npm install
```

3. 构建项目:
```
npm run build
```

## 使用选项

有两种方式可以在 Claude 中使用此 MCP 服务器:

1. **直接使用**: 全局安装包并直接使用
2. **本地开发**: 从本地开发环境运行

### 使用 NPM 包直接安装

使用此 MCP 服务器最简单的方法是全局安装:

```bash
npm install -g @cmd233/mcp-mssql
```

这允许您直接使用服务器,无需在本地构建。

### 本地开发设置

如果您想修改代码或在本地环境运行:

1. 按照安装部分所示克隆并构建仓库
2. 使用下面使用部分中的命令运行服务器

## 使用方法

### SQLite 数据库

用于 SQLite 数据库:

```
node dist/src/index.js /path/to/your/database.db
```

### SQL Server 数据库

用于 SQL Server 数据库:

```
node dist/src/index.js --sqlserver --server <server-name> --database <database-name> [--user <username> --password <password>]
```

必需参数:
- `--server`: SQL Server 主机名或 IP 地址
- `--database`: 数据库名称

可选参数:
- `--user`: SQL Server 认证的用户名(如果未提供,将使用 Windows 身份验证)
- `--password`: SQL Server 认证的密码
- `--port`: 端口号(默认: 1433)

### PostgreSQL 数据库

用于 PostgreSQL 数据库:

```
node dist/src/index.js --postgresql --host <host-name> --database <database-name> [--user <username> --password <password>]
```

必需参数:
- `--host`: PostgreSQL 主机名或 IP 地址
- `--database`: 数据库名称

可选参数:
- `--user`: PostgreSQL 认证的用户名
- `--password`: PostgreSQL 认证的密码
- `--port`: 端口号(默认: 5432)
- `--ssl`: 启用 SSL 连接 (true/false)
- `--connection-timeout`: 连接超时时间(毫秒,默认: 30000)

### MySQL 数据库

#### 标准认证

用于 MySQL 数据库:

```
node dist/src/index.js --mysql --host <host-name> --database <database-name> --port <port> [--user <username> --password <password>]
```

必需参数:
- `--host`: MySQL 主机名或 IP 地址
- `--database`: 数据库名称

可选参数:
- `--port`: 端口号(默认: 3306)

可选参数:
- `--user`: MySQL 认证的用户名
- `--password`: MySQL 认证的密码
- `--ssl`: 启用 SSL 连接 (true/false 或对象)
- `--connection-timeout`: 连接超时时间(毫秒,默认: 30000)

#### AWS IAM 认证

对于支持 IAM 数据库认证的 Amazon RDS MySQL 实例:

**前置条件:**
- 必须配置 AWS 凭据(RDS 签名者使用默认凭据提供程序链)
- 使用以下方法之一配置:
  - `aws configure`(使用默认配置文件)
  - `AWS_PROFILE=myprofile` 环境变量
  - `AWS_ACCESS_KEY_ID` 和 `AWS_SECRET_ACCESS_KEY` 环境变量
  - IAM 角色(如果在 EC2 上运行)

```
node dist/src/index.js --mysql --aws-iam-auth --host <rds-endpoint> --database <database-name> --user <aws-username> --aws-region <region>
```

必需参数:
- `--host`: RDS 端点主机名
- `--database`: 数据库名称
- `--aws-iam-auth`: 启用 AWS IAM 认证
- `--user`: AWS IAM 用户名(也是数据库用户)
- `--aws-region`: RDS 实例所在的 AWS 区域

注意: AWS IAM 认证会自动启用 SSL

## 配置 Claude Desktop

### 直接使用配置

如果您全局安装了包,使用以下配置配置 Claude Desktop:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@cmd233/mcp-mssql",
        "/path/to/your/database.db"
      ]
    },
    "sqlserver": {
      "command": "npx",
      "args": [
        "-y",
        "@cmd233/mcp-mssql",
        "--sqlserver",
        "--server", "your-server-name",
        "--database", "your-database-name",
        "--user", "your-username",
        "--password", "your-password"
      ]
    },
    "postgresql": {
      "command": "npx",
      "args": [
        "-y",
        "@cmd233/mcp-mssql",
        "--postgresql",
        "--host", "your-host-name",
        "--database", "your-database-name",
        "--user", "your-username",
        "--password", "your-password"
      ]
    },
    "mysql": {
      "command": "npx",
      "args": [
        "-y",
        "@cmd233/mcp-mssql",
        "--mysql",
        "--host", "your-host-name",
        "--database", "your-database-name",
        "--port", "3306",
        "--user", "your-username",
        "--password", "your-password"
      ]
    },
    "mysql-aws": {
      "command": "npx",
      "args": [
        "-y",
        "@cmd233/mcp-mssql",
        "--mysql",
        "--aws-iam-auth",
        "--host", "your-rds-endpoint.region.rds.amazonaws.com",
        "--database", "your-database-name",
        "--user", "your-aws-username",
        "--aws-region", "us-east-1"
      ]
    }
  }
}
```

### 本地开发配置

对于本地开发,配置 Claude Desktop 使用您本地构建的版本:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-mssql/dist/src/index.js",
        "/path/to/your/database.db"
      ]
    },
    "sqlserver": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-mssql/dist/src/index.js",
        "--sqlserver",
        "--server", "your-server-name",
        "--database", "your-database-name",
        "--user", "your-username",
        "--password", "your-password"
      ]
    },
    "postgresql": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-mssql/dist/src/index.js",
        "--postgresql",
        "--host", "your-host-name",
        "--database", "your-database-name",
        "--user", "your-username",
        "--password", "your-password"
      ]
    },
    "mysql": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-mssql/dist/src/index.js",
        "--mysql",
        "--host", "your-host-name",
        "--database", "your-database-name",
        "--port", "3306",
        "--user", "your-username",
        "--password", "your-password"
      ]
    },
    "mysql-aws": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-mssql/dist/src/index.js",
        "--mysql",
        "--aws-iam-auth",
        "--host", "your-rds-endpoint.region.rds.amazonaws.com",
        "--database", "your-database-name",
        "--user", "your-aws-username",
        "--aws-region", "us-east-1"
      ]
    }
  }
}
```

Claude Desktop 配置文件通常位于:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

## 可用的数据库工具

MCP 数据库服务器提供以下可供 Claude 使用的工具:

| 工具 | 描述 | 必需参数 |
|------|-------------|---------------------|
| `read_query` | 执行 SELECT 查询以读取数据 | `query`: SQL SELECT 语句 |
| `write_query` | 执行 INSERT、UPDATE、DELETE 或 TRUNCATE 查询 | `query`: SQL 修改语句<br>`confirm`: 安全标志(必须为 true) |
| `create_table` | 在数据库中创建新表 | `query`: CREATE TABLE 语句<br>`confirm`: 安全标志(必须为 true) |
| `alter_table` | 修改现有表架构 | `query`: ALTER TABLE 语句<br>`confirm`: 安全标志(必须为 true) |
| `drop_table` | 从数据库中删除表 | `table_name`: 表名<br>`confirm`: 安全标志(必须为 true) |
| `list_tables` | 获取所有表的列表 | 无 |
| `describe_table` | 查看表的架构信息 | `table_name`: 表名 |
| `export_query` | 将查询结果导出为 CSV/JSON | `query`: SQL SELECT 语句<br>`format`: "csv" 或 "json" |
| `append_insight` | 添加业务洞察到备忘录 (**仅 SQLite**) | `insight`: 洞察文本<br>`confirm`: 安全标志(必须为 true) |
| `list_insights` | 列出所有业务洞察 (**仅 SQLite**) | 无 |
| `list_views` | 列出所有视图 (**仅 SQL Server**) | 无 |
| `describe_view` | 获取视图结构 (**仅 SQL Server**) | `view_name`: 视图名 |
| `get_view_definition` | 获取视图定义 SQL (**仅 SQL Server**) | `view_name`: 视图名 |

有关如何在 Claude 中使用这些工具的实际示例,请参阅[使用示例](docs/usage-examples.md)。

## 附加文档

- [SQL Server 设置指南](docs/sql-server-setup.md): 连接到 SQL Server 数据库的详细信息
- [PostgreSQL 设置指南](docs/postgresql-setup.md): 连接到 PostgreSQL 数据库的详细信息
- [使用示例](docs/usage-examples.md): 与 Claude 一起使用的示例查询和命令

## 开发

以开发模式运行服务器:

```
npm run dev
```

在开发期间监视更改:

```
npm run watch
```

## 系统要求

- Node.js 18+
- SQL Server 连接: SQL Server 2012 或更高版本
- PostgreSQL 连接: PostgreSQL 9.5 或更高版本

## 许可证

MIT
