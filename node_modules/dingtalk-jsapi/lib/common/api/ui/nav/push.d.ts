export declare const apiName = "ui.nav.push";
/**
 * 往路径堆栈中push路径 请求参数定义
 * @apiName ui.nav.push
 */
export interface IUiNavPushParams {
    [key: string]: any;
}
/**
 * 往路径堆栈中push路径 返回结果定义
 * @apiName ui.nav.push
 */
export interface IUiNavPushResult {
    [key: string]: any;
}
/**
 * 往路径堆栈中push路径
 * @apiName ui.nav.push
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function push$(params: IUiNavPushParams): Promise<IUiNavPushResult>;
export default push$;
