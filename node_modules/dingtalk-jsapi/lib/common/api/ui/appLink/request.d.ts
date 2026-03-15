export declare const apiName = "ui.appLink.request";
/**
 * 发送消息 请求参数定义
 * @apiName ui.appLink.request
 */
export interface IUiAppLinkRequestParams {
    [key: string]: any;
}
/**
 * 发送消息 返回结果定义
 * @apiName ui.appLink.request
 */
export interface IUiAppLinkRequestResult {
    [key: string]: any;
}
/**
 * 发送消息
 * @apiName ui.appLink.request
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function request$(params: IUiAppLinkRequestParams): Promise<IUiAppLinkRequestResult>;
export default request$;
