import { ICommonAPIParams } from '../../../constant/types';
/**
 * 获取当前域名下，所有存储在本地数据 key 以及存储量信息 请求参数定义
 * @apiName util.domainStorage.getStorageInfo
 */
export interface IUtilDomainStorageGetStorageInfoParams extends ICommonAPIParams {
}
/**
 * 获取当前域名下，所有存储在本地数据 key 以及存储量信息 返回结果定义
 * @apiName util.domainStorage.getStorageInfo
 */
export interface IUtilDomainStorageGetStorageInfoResult {
    keys: string[];
    limitSize: number;
    currentSize: number;
}
/**
 * 获取当前域名下，所有存储在本地数据 key 以及存储量信息
 * @apiName util.domainStorage.getStorageInfo
 */
export declare function getStorageInfo$(params: IUtilDomainStorageGetStorageInfoParams): Promise<IUtilDomainStorageGetStorageInfoResult>;
export default getStorageInfo$;
