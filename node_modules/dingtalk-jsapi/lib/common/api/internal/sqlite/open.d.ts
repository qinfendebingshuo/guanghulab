export declare const apiName = "internal.sqlite.open";
/**
 * 打开SQLite数据库 请求参数定义
 * @apiName internal.sqlite.open
 */
export interface IInternalSqliteOpenParams {
    /** 数据库名 */
    db: string;
    /** db版本号 */
    version: number;
    /** 是否加密 */
    isCrypto?: boolean;
    /** 初次创建表的sql列表 */
    createSqls: string[];
    upgradeSqls?: any;
}
/**
 * 打开SQLite数据库 返回结果定义
 * @apiName internal.sqlite.open
 */
export interface IInternalSqliteOpenResult {
    dbSize: number;
}
/**
 * 打开SQLite数据库
 * @apiName internal.sqlite.open
 * @supportVersion ios: 5.1.15 android: 5.1.18 pc: 5.1.17
 * @author ios: 冬翔 android: 步定 Windows:平戈(Backup: 秋酷) Mac:北塔
 */
export declare function open$(params: IInternalSqliteOpenParams): Promise<IInternalSqliteOpenResult>;
export default open$;
