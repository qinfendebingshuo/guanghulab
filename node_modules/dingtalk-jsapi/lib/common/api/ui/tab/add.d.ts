export declare const apiName = "ui.tab.add";
/**
 * 增加tab 请求参数定义
 * @apiName ui.tab.add
 */
export interface IUiTabAddParams {
    [key: string]: any;
}
/**
 * 增加tab 返回结果定义
 * @apiName ui.tab.add
 */
export interface IUiTabAddResult {
    [key: string]: any;
}
/**
 * 增加tab
 * @apiName ui.tab.add
 * @supportVersion  android: 2.7.6
 */
export declare function add$(params: IUiTabAddParams): Promise<IUiTabAddResult>;
export default add$;
