export declare const apiName = "internal.work.getApplist";
/**
 * 获取App列表 请求参数定义
 * @apiName internal.work.getApplist
 */
export interface IInternalWorkGetApplistParams {
    [key: string]: any;
}
/**
 * 获取App列表 返回结果定义
 * @apiName internal.work.getApplist
 */
export interface IInternalWorkGetApplistResult {
    [key: string]: any;
}
/**
 * 获取App列表
 * @apiName internal.work.getApplist
 * @supportVersion  pc: 4.1.0
 */
export declare function getApplist$(params: IInternalWorkGetApplistParams): Promise<IInternalWorkGetApplistResult>;
export default getApplist$;
