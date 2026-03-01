/**
 * SQL 操作验证工具
 * 集中管理禁用的 SQL 操作，确保数据库安全
 */

/**
 * 禁用的 SQL 操作类型及其错误消息
 */
const FORBIDDEN_OPERATIONS: { pattern: RegExp; message: string }[] = [
    {
        pattern: /^\s*DROP\s/i,
        message: 'DROP 操作已被禁用，此类操作应由 DBA 在数据库层面处理'
    },
    {
        pattern: /^\s*TRUNCATE\s/i,
        message: 'TRUNCATE 操作已被禁用，因为它不可回滚且不触发触发器'
    }
];

/**
 * 验证 SQL 查询是否包含禁用的操作
 * @param query 要验证的 SQL 查询
 * @throws Error 如果查询包含禁用的操作
 */
export function validateForbiddenOperations(query: string): void {
    for (const { pattern, message } of FORBIDDEN_OPERATIONS) {
        if (pattern.test(query)) {
            throw new Error(message);
        }
    }
}
