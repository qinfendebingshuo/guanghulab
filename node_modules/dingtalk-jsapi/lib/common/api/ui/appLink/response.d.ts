export declare const apiName = "ui.appLink.response";
/**
 * 返回消息 请求参数定义
 * @apiName ui.appLink.response
 */
export interface IUiAppLinkResponseParams {
    [key: string]: any;
}
/**
 * 返回消息 返回结果定义
 * @apiName ui.appLink.response
 */
export interface IUiAppLinkResponseResult {
    [key: string]: any;
}
/**
 * 返回消息
 * @apiName ui.appLink.response
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function response$(params: IUiAppLinkResponseParams): Promise<IUiAppLinkResponseResult>;
export default response$;
