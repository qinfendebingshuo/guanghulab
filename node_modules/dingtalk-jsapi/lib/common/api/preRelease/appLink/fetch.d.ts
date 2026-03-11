export declare const apiName = "preRelease.appLink.fetch";
/**
 * 获取请求页面（sourceApp）的数据 请求参数定义
 * @apiName preRelease.appLink.fetch
 */
export interface IPreReleaseAppLinkFetchParams {
    [key: string]: any;
}
/**
 * 获取请求页面（sourceApp）的数据 返回结果定义
 * @apiName preRelease.appLink.fetch
 */
export interface IPreReleaseAppLinkFetchResult {
    [key: string]: any;
}
/**
 * 获取请求页面（sourceApp）的数据
 * @apiName preRelease.appLink.fetch
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function fetch$(params: IPreReleaseAppLinkFetchParams): Promise<IPreReleaseAppLinkFetchResult>;
export default fetch$;
