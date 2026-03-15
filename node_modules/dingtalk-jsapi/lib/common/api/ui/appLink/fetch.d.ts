export declare const apiName = "ui.appLink.fetch";
/**
 * 获取请求页面（sourceApp）的数据 请求参数定义
 * @apiName ui.appLink.fetch
 */
export interface IUiAppLinkFetchParams {
    [key: string]: any;
}
/**
 * 获取请求页面（sourceApp）的数据 返回结果定义
 * @apiName ui.appLink.fetch
 */
export interface IUiAppLinkFetchResult {
    [key: string]: any;
}
/**
 * 获取请求页面（sourceApp）的数据
 * @apiName ui.appLink.fetch
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function fetch$(params: IUiAppLinkFetchParams): Promise<IUiAppLinkFetchResult>;
export default fetch$;
