import { ICommonAPIParams } from '../../constant/types';
/**
 * 异步获取指定key的缓存数据 请求参数定义
 * @apiName getStorage
 */
export interface IUnionGetStorageParams extends ICommonAPIParams {
    key: string;
}
/**
 * 异步获取指定key的缓存数据 返回结果定义
 * @apiName getStorage
 */
export interface IUnionGetStorageResult {
}
/**
 * 异步获取指定key的缓存数据
 * @apiName getStorage
 */
export declare function getStorage$(params: IUnionGetStorageParams): Promise<IUnionGetStorageResult>;
export default getStorage$;
