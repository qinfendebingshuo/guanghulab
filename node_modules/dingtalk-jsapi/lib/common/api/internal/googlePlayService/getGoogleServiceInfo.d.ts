export declare const apiName = "internal.googlePlayService.getGoogleServiceInfo";
/**
 * 获取手机上是否有googleplay服务 请求参数定义
 * @apiName internal.googlePlayService.getGoogleServiceInfo
 */
export interface IInternalGooglePlayServiceGetGoogleServiceInfoParams {
}
/**
 * 获取手机上是否有googleplay服务 返回结果定义
 * @apiName internal.googlePlayService.getGoogleServiceInfo
 */
export interface IInternalGooglePlayServiceGetGoogleServiceInfoResult {
    hasGoogleService: boolean;
}
/**
 * 获取手机上是否有googleplay服务
 * @apiName internal.googlePlayService.getGoogleServiceInfo
 * @supportVersion android: 4.5.6
 */
export declare function getGoogleServiceInfo$(params: IInternalGooglePlayServiceGetGoogleServiceInfoParams): Promise<IInternalGooglePlayServiceGetGoogleServiceInfoResult>;
export default getGoogleServiceInfo$;
