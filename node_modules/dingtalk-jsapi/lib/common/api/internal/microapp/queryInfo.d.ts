export declare const apiName = "internal.microapp.queryInfo";
/**
 * 批量获取微应用信息 请求参数定义
 * @apiName internal.microapp.queryInfo
 */
export interface IInternalMicroappQueryInfoParams {
    [key: string]: any;
}
/**
 * 批量获取微应用信息 返回结果定义
 * @apiName internal.microapp.queryInfo
 */
export interface IInternalMicroappQueryInfoResult {
    [key: string]: any;
}
/**
 * 批量获取微应用信息
 * @apiName internal.microapp.queryInfo
 * @supportVersion  ios: 3.4.1 android: 3.4.1
 */
export declare function queryInfo$(params: IInternalMicroappQueryInfoParams): Promise<IInternalMicroappQueryInfoResult>;
export default queryInfo$;
