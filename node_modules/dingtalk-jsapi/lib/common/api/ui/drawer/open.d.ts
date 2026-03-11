export declare const apiName = "ui.drawer.open";
/**
 *  请求参数定义
 * @apiName ui.drawer.open
 */
export interface IUiDrawerOpenParams {
    [key: string]: any;
}
/**
 *  返回结果定义
 * @apiName ui.drawer.open
 */
export interface IUiDrawerOpenResult {
    [key: string]: any;
}
/**
 *
 * @apiName ui.drawer.open
 * @supportVersion  ios: 2.6.0 android: 2.6.0
 */
export declare function open$(params: IUiDrawerOpenParams): Promise<IUiDrawerOpenResult>;
export default open$;
