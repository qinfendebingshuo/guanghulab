export declare const apiName = "internal.host.query";
/**
 * 查询离线托管任务 请求参数定义
 * @apiName internal.host.query
 */
export interface IInternalHostQueryParams {
    [key: string]: any;
}
/**
 * 查询离线托管任务 返回结果定义
 * @apiName internal.host.query
 */
export interface IInternalHostQueryResult {
    [key: string]: any;
}
/**
 * 查询离线托管任务
 * @apiName internal.host.query
 * @supportVersion  ios: 2.9.0 android: 2.9.0
 */
export declare function query$(params: IInternalHostQueryParams): Promise<IInternalHostQueryResult>;
export default query$;
