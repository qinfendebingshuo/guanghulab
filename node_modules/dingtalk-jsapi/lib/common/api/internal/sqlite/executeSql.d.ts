export declare const apiName = "internal.sqlite.executeSql";
/**
 * 执行SQLite SQL语句 请求参数定义
 * @apiName internal.sqlite.executeSql
 */
export interface IInternalSqliteExecuteSqlParams {
    /** 数据库名 */
    db: string;
    sqlStmts: Array<{
        sql: string;
        args: any[];
    }>;
}
/**
 * 执行SQLite SQL语句 返回结果定义
 * @apiName internal.sqlite.executeSql
 */
export interface IInternalSqliteExecuteSqlResult {
    result: any;
}
/**
 * 执行SQLite SQL语句
 * @apiName internal.sqlite.executeSql
 * @supportVersion ios: 5.1.15 android: 5.1.18 pc: 5.1.17
 * @author ios: 冬翔 android: 步定 Windows:平戈(Backup: 秋酷) Mac:北塔
 */
export declare function executeSql$(params: IInternalSqliteExecuteSqlParams): Promise<IInternalSqliteExecuteSqlResult>;
export default executeSql$;
