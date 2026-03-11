export declare const apiName = "util.localStorage.removeItem";
/**
 * 本地存储移除操作 请求参数定义
 * @apiName util.localStorage.removeItem
 */
export interface IUtilLocalStorageRemoveItemParams {
    [key: string]: any;
}
/**
 * 本地存储移除操作 返回结果定义
 * @apiName util.localStorage.removeItem
 */
export interface IUtilLocalStorageRemoveItemResult {
    [key: string]: any;
}
/**
 * 本地存储移除操作
 * @apiName util.localStorage.removeItem
 * @supportVersion  ios: 2.4.2 android: 2.4.2
 */
export declare function removeItem$(params: IUtilLocalStorageRemoveItemParams): Promise<IUtilLocalStorageRemoveItemResult>;
export default removeItem$;
