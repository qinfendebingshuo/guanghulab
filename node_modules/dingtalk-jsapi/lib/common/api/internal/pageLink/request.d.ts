export declare const apiName = "internal.pageLink.request";
/**
 * 发送消息 请求参数定义
 * @apiName internal.pageLink.request
 */
export interface IInternalPageLinkRequestParams {
    [key: string]: any;
}
/**
 * 发送消息 返回结果定义
 * @apiName internal.pageLink.request
 */
export interface IInternalPageLinkRequestResult {
    [key: string]: any;
}
/**
 * 发送消息
 * @apiName internal.pageLink.request
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function request$(params: IInternalPageLinkRequestParams): Promise<IInternalPageLinkRequestResult>;
export default request$;
