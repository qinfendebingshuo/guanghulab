export declare const apiName = "ui.drawer.enable";
/**
 *  请求参数定义
 * @apiName ui.drawer.enable
 */
export interface IUiDrawerEnableParams {
    [key: string]: any;
}
/**
 *  返回结果定义
 * @apiName ui.drawer.enable
 */
export interface IUiDrawerEnableResult {
    [key: string]: any;
}
/**
 *
 * @apiName ui.drawer.enable
 * @supportVersion  ios: 2.6.0 android: 2.6.0
 */
export declare function enable$(params: IUiDrawerEnableParams): Promise<IUiDrawerEnableResult>;
export default enable$;
