export declare const apiName = "internal.safe.getAppInfo";
/**
 * 获取App信息 请求参数定义
 * @apiName internal.safe.getAppInfo
 */
export interface IInternalSafeGetAppInfoParams {
    [key: string]: any;
}
/**
 * 获取App信息 返回结果定义
 * @apiName internal.safe.getAppInfo
 */
export interface IInternalSafeGetAppInfoResult {
    [key: string]: any;
}
/**
 * 获取App信息
 * @apiName internal.safe.getAppInfo
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function getAppInfo$(params: IInternalSafeGetAppInfoParams): Promise<IInternalSafeGetAppInfoResult>;
export default getAppInfo$;
