export declare const apiName = "ui.tab.select";
/**
 * tab选择 请求参数定义
 * @apiName ui.tab.select
 */
export interface IUiTabSelectParams {
    [key: string]: any;
}
/**
 * tab选择 返回结果定义
 * @apiName ui.tab.select
 */
export interface IUiTabSelectResult {
    [key: string]: any;
}
/**
 * tab选择
 * @apiName ui.tab.select
 * @supportVersion  android: 2.7.6
 */
export declare function select$(params: IUiTabSelectParams): Promise<IUiTabSelectResult>;
export default select$;
