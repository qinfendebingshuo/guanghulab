export declare const apiName = "internal.pageLink.fetch";
/**
 * 获取请求页面（sourceApp）的数据 请求参数定义
 * @apiName internal.pageLink.fetch
 */
export interface IInternalPageLinkFetchParams {
    [key: string]: any;
}
/**
 * 获取请求页面（sourceApp）的数据 返回结果定义
 * @apiName internal.pageLink.fetch
 */
export interface IInternalPageLinkFetchResult {
    [key: string]: any;
}
/**
 * 获取请求页面（sourceApp）的数据
 * @apiName internal.pageLink.fetch
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function fetch$(params: IInternalPageLinkFetchParams): Promise<IInternalPageLinkFetchResult>;
export default fetch$;
