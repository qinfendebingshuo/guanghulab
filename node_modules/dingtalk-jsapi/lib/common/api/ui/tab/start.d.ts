export declare const apiName = "ui.tab.start";
/**
 * 唤起tab 请求参数定义
 * @apiName ui.tab.start
 */
export interface IUiTabStartParams {
    [key: string]: any;
}
/**
 * 唤起tab 返回结果定义
 * @apiName ui.tab.start
 */
export interface IUiTabStartResult {
    [key: string]: any;
}
/**
 * 唤起tab
 * @apiName ui.tab.start
 * @supportVersion  android: 2.7.6
 */
export declare function start$(params: IUiTabStartParams): Promise<IUiTabStartResult>;
export default start$;
