export declare const apiName = "util.localStorage.getItem";
/**
 * 本地存储读 请求参数定义
 * @apiName util.localStorage.getItem
 */
export interface IUtilLocalStorageGetItemParams {
    [key: string]: any;
}
/**
 * 本地存储读 返回结果定义
 * @apiName util.localStorage.getItem
 */
export interface IUtilLocalStorageGetItemResult {
    [key: string]: any;
}
/**
 * 本地存储读
 * @apiName util.localStorage.getItem
 * @supportVersion  ios: 2.4.2 android: 2.4.2
 */
export declare function getItem$(params: IUtilLocalStorageGetItemParams): Promise<IUtilLocalStorageGetItemResult>;
export default getItem$;
