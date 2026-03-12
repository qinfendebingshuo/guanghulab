export declare const apiName = "internal.hpm.queryInfo";
/**
 * hpm查询 请求参数定义
 * @apiName internal.hpm.queryInfo
 */
export interface IInternalHpmQueryInfoParams {
    [key: string]: any;
}
/**
 * hpm查询 返回结果定义
 * @apiName internal.hpm.queryInfo
 */
export interface IInternalHpmQueryInfoResult {
    [key: string]: any;
}
/**
 * hpm查询
 * @apiName internal.hpm.queryInfo
 * @supportVersion  ios: 2.15.0 android: 2.15.0
 */
export declare function queryInfo$(params: IInternalHpmQueryInfoParams): Promise<IInternalHpmQueryInfoResult>;
export default queryInfo$;
