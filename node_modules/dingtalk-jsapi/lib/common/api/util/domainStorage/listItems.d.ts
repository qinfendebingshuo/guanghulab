export declare const apiName = "util.domainStorage.listItems";
/**
 * 获取当前域名下，所有存储在本地的数据key以及长度信息 请求参数定义
 * @apiName util.domainStorage.listItems
 */
export interface IUtilDomainStorageListItemsParams {
    [key: string]: any;
}
/**
 * 获取当前域名下，所有存储在本地的数据key以及长度信息 返回结果定义
 * @apiName util.domainStorage.listItems
 */
export interface IUtilDomainStorageListItemsResult {
    [key: string]: any;
}
/**
 * 获取当前域名下，所有存储在本地的数据key以及长度信息
 * @apiName util.domainStorage.listItems
 * @supportVersion  ios: 3.5.1 android: 3.5.1
 */
export declare function listItems$(params: IUtilDomainStorageListItemsParams): Promise<IUtilDomainStorageListItemsResult>;
export default listItems$;
