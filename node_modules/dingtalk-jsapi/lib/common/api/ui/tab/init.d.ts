export declare const apiName = "ui.tab.init";
/**
 * 初始化tab 请求参数定义
 * @apiName ui.tab.init
 */
export interface IUiTabInitParams {
    [key: string]: any;
}
/**
 * 初始化tab 返回结果定义
 * @apiName ui.tab.init
 */
export interface IUiTabInitResult {
    [key: string]: any;
}
/**
 * 初始化tab
 * @apiName ui.tab.init
 * @supportVersion  android: 2.7.6
 */
export declare function init$(params: IUiTabInitParams): Promise<IUiTabInitResult>;
export default init$;
