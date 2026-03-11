export declare const apiName = "util.localStorage.setItem";
/**
 * 本地存储写 请求参数定义
 * @apiName util.localStorage.setItem
 */
export interface IUtilLocalStorageSetItemParams {
    [key: string]: any;
}
/**
 * 本地存储写 返回结果定义
 * @apiName util.localStorage.setItem
 */
export interface IUtilLocalStorageSetItemResult {
    [key: string]: any;
}
/**
 * 本地存储写
 * @apiName util.localStorage.setItem
 * @supportVersion  ios: 2.4.2 android: 2.4.2
 */
export declare function setItem$(params: IUtilLocalStorageSetItemParams): Promise<IUtilLocalStorageSetItemResult>;
export default setItem$;
