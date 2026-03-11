export declare const apiName = "preRelease.appLink.response";
/**
 * 返回消息 请求参数定义
 * @apiName preRelease.appLink.response
 */
export interface IPreReleaseAppLinkResponseParams {
    [key: string]: any;
}
/**
 * 返回消息 返回结果定义
 * @apiName preRelease.appLink.response
 */
export interface IPreReleaseAppLinkResponseResult {
    [key: string]: any;
}
/**
 * 返回消息
 * @apiName preRelease.appLink.response
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function response$(params: IPreReleaseAppLinkResponseParams): Promise<IPreReleaseAppLinkResponseResult>;
export default response$;
