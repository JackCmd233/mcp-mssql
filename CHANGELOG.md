# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-02-28

### Added
- **SQL Server 视图支持**: 新增三个视图相关工具
  - `list_views`: 列出数据库中所有视图
  - `describe_view`: 获取视图的列结构信息
  - `get_view_definition`: 获取视图的 SQL 定义语句
- **安全确认机制**: 数据修改工具（`write_query`、`create_table`、`alter_table`、`drop_table`、`append_insight`）新增 `confirm` 参数，默认不执行操作，需设置 `confirm=true` 才能执行，防止误操作

### Changed
- 完善所有 MCP 工具的描述信息，提升 Claude Code 使用体验
- 统一代码格式和缩进风格
- 更新数据库适配器中的日志消息为中文
- 改进 CLAUDE.md 项目文档

### Fixed
- 修复 SQL Server 可空字段检测逻辑（`IS_NULLABLE` 映射错误）

## [1.1.7] - 2025-01-25

### Changed
- 完成全面的中文本地化
- 所有源代码注释翻译为中文
- 错误消息和日志消息中文化

### Fixed
- 修复可空字段检测问题

## [1.1.6] - 2025-01-20

### Added
- 支持 PostgreSQL 数据库
- 支持 MySQL 数据库（含 AWS IAM 认证）

### Changed
- 重构数据库适配器架构

## [1.1.0] - 2025-01-15

### Added
- 支持 SQL Server 数据库（Windows 集成认证）
- 添加业务洞察备忘录功能（仅 SQLite）

## [1.0.0] - 2025-01-10

### Added
- 初始版本
- 支持 SQLite 数据库
- 基础 MCP 工具：`read_query`、`write_query`、`list_tables`、`describe_table`、`create_table`、`alter_table`、`drop_table`、`export_query`
