export declare const apiName = "util.domainStorage.getItems";
/**
 * 批量查询本地缓存 请求参数定义
 * @apiName util.domainStorage.getItems
 */
export interface IUtilDomainStorageGetItemsParams {
    /** 存储信息的key值数组 */
    names: string[];
}
/**
 * 批量查询本地缓存 返回结果定义
 * @apiName util.domainStorage.getItems
 */
export interface IUtilDomainStorageGetItemsResult {
    storages: Array<{
        key: string;
        value: string;
    }>;
}
/**
 * 批量查询本地缓存
 * @apiName util.domainStorage.getItems
 * @supportVersion ios: 5.1.23 android: 5.1.23
 * @author iOS: 无最 Android：煮虾
 */
export declare function getItems$(params: IUtilDomainStorageGetItemsParams): Promise<IUtilDomainStorageGetItemsResult>;
export default getItems$;
