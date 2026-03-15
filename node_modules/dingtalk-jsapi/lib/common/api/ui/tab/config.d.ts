export declare const apiName = "ui.tab.config";
/**
 * 配置tab 请求参数定义
 * @apiName ui.tab.config
 */
export interface IUiTabConfigParams {
    [key: string]: any;
}
/**
 * 配置tab 返回结果定义
 * @apiName ui.tab.config
 */
export interface IUiTabConfigResult {
    [key: string]: any;
}
/**
 * 配置tab
 * @apiName ui.tab.config
 * @supportVersion  android: 2.7.6
 */
export declare function config$(params: IUiTabConfigParams): Promise<IUiTabConfigResult>;
export default config$;
