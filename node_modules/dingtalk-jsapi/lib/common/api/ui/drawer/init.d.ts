export declare const apiName = "ui.drawer.init";
/**
 *  请求参数定义
 * @apiName ui.drawer.init
 */
export interface IUiDrawerInitParams {
    [key: string]: any;
}
/**
 *  返回结果定义
 * @apiName ui.drawer.init
 */
export interface IUiDrawerInitResult {
    [key: string]: any;
}
/**
 *
 * @apiName ui.drawer.init
 * @supportVersion  ios: 2.6.0 android: 2.6.0
 */
export declare function init$(params: IUiDrawerInitParams): Promise<IUiDrawerInitResult>;
export default init$;
