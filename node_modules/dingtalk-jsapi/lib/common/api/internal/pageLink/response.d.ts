export declare const apiName = "internal.pageLink.response";
/**
 * 返回消息 请求参数定义
 * @apiName internal.pageLink.response
 */
export interface IInternalPageLinkResponseParams {
    [key: string]: any;
}
/**
 * 返回消息 返回结果定义
 * @apiName internal.pageLink.response
 */
export interface IInternalPageLinkResponseResult {
    [key: string]: any;
}
/**
 * 返回消息
 * @apiName internal.pageLink.response
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function response$(params: IInternalPageLinkResponseParams): Promise<IInternalPageLinkResponseResult>;
export default response$;
