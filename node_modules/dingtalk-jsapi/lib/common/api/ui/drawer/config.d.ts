export declare const apiName = "ui.drawer.config";
/**
 *  请求参数定义
 * @apiName ui.drawer.config
 */
export interface IUiDrawerConfigParams {
    [key: string]: any;
}
/**
 *  返回结果定义
 * @apiName ui.drawer.config
 */
export interface IUiDrawerConfigResult {
    [key: string]: any;
}
/**
 *
 * @apiName ui.drawer.config
 * @supportVersion  ios: 2.6.0 android: 2.6.0
 */
export declare function config$(params: IUiDrawerConfigParams): Promise<IUiDrawerConfigResult>;
export default config$;
