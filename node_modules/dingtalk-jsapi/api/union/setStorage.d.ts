import { ICommonAPIParams } from '../../constant/types';
/**
 * 将数据存储在本地缓存 请求参数定义
 * @apiName setStorage
 */
export interface IUnionSetStorageParams extends ICommonAPIParams {
    key: string;
    data: string;
}
/**
 * 将数据存储在本地缓存 返回结果定义
 * @apiName setStorage
 */
export interface IUnionSetStorageResult {
}
/**
 * 将数据存储在本地缓存
 * @apiName setStorage
 */
export declare function setStorage$(params: IUnionSetStorageParams): Promise<IUnionSetStorageResult>;
export default setStorage$;
