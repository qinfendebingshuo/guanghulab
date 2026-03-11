export declare const apiName = "ui.drawer.disable";
/**
 *  请求参数定义
 * @apiName ui.drawer.disable
 */
export interface IUiDrawerDisableParams {
    [key: string]: any;
}
/**
 *  返回结果定义
 * @apiName ui.drawer.disable
 */
export interface IUiDrawerDisableResult {
    [key: string]: any;
}
/**
 *
 * @apiName ui.drawer.disable
 * @supportVersion  ios: 2.6.0 android: 2.6.0
 */
export declare function disable$(params: IUiDrawerDisableParams): Promise<IUiDrawerDisableResult>;
export default disable$;
