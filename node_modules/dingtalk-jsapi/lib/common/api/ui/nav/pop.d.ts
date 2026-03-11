export declare const apiName = "ui.nav.pop";
/**
 * 路径堆栈中删除view 路径 请求参数定义
 * @apiName ui.nav.pop
 */
export interface IUiNavPopParams {
    [key: string]: any;
}
/**
 * 路径堆栈中删除view 路径 返回结果定义
 * @apiName ui.nav.pop
 */
export interface IUiNavPopResult {
    [key: string]: any;
}
/**
 * 路径堆栈中删除view 路径
 * @apiName ui.nav.pop
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function pop$(params: IUiNavPopParams): Promise<IUiNavPopResult>;
export default pop$;
