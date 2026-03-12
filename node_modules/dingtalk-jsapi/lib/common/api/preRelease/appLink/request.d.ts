export declare const apiName = "preRelease.appLink.request";
/**
 * 发送消息 请求参数定义
 * @apiName preRelease.appLink.request
 */
export interface IPreReleaseAppLinkRequestParams {
    [key: string]: any;
}
/**
 * 发送消息 返回结果定义
 * @apiName preRelease.appLink.request
 */
export interface IPreReleaseAppLinkRequestResult {
    [key: string]: any;
}
/**
 * 发送消息
 * @apiName preRelease.appLink.request
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function request$(params: IPreReleaseAppLinkRequestParams): Promise<IPreReleaseAppLinkRequestResult>;
export default request$;
