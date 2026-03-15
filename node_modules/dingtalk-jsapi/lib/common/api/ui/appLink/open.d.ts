export declare const apiName = "ui.appLink.open";
/**
 * 应用跳转 请求参数定义
 * @apiName ui.appLink.open
 */
export interface IUiAppLinkOpenParams {
    [key: string]: any;
}
/**
 * 应用跳转 返回结果定义
 * @apiName ui.appLink.open
 */
export interface IUiAppLinkOpenResult {
    [key: string]: any;
}
/**
 * 应用跳转
 * @apiName ui.appLink.open
 * @supportVersion  ios: 2.7.0 android: 2.7.0
 */
export declare function open$(params: IUiAppLinkOpenParams): Promise<IUiAppLinkOpenResult>;
export default open$;
