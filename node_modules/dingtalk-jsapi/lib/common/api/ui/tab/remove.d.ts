export declare const apiName = "ui.tab.remove";
/**
 * 移除tab 请求参数定义
 * @apiName ui.tab.remove
 */
export interface IUiTabRemoveParams {
    [key: string]: any;
}
/**
 * 移除tab 返回结果定义
 * @apiName ui.tab.remove
 */
export interface IUiTabRemoveResult {
    [key: string]: any;
}
/**
 * 移除tab
 * @apiName ui.tab.remove
 * @supportVersion  android: 2.7.6
 */
export declare function remove$(params: IUiTabRemoveParams): Promise<IUiTabRemoveResult>;
export default remove$;
