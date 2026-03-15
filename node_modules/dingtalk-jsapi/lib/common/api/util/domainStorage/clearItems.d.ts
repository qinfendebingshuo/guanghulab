export declare const apiName = "util.domainStorage.clearItems";
/**
 * 本地存储（区分域名）清空 请求参数定义
 * @apiName util.domainStorage.clearItems
 */
export interface IUtilDomainStorageClearItemsParams {
    [key: string]: any;
}
/**
 * 本地存储（区分域名）清空 返回结果定义
 * @apiName util.domainStorage.clearItems
 */
export interface IUtilDomainStorageClearItemsResult {
    [key: string]: any;
}
/**
 * 本地存储（区分域名）清空
 * @apiName util.domainStorage.clearItems
 * @supportVersion  ios: 2.9.0 android: 2.9.0
 */
export declare function clearItems$(params: IUtilDomainStorageClearItemsParams): Promise<IUtilDomainStorageClearItemsResult>;
export default clearItems$;
