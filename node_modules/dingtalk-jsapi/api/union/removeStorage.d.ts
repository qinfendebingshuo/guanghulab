import { ICommonAPIParams } from '../../constant/types';
/**
 * 删除缓存数据 请求参数定义
 * @apiName removeStorage
 */
export interface IUnionRemoveStorageParams extends ICommonAPIParams {
    key: string;
}
/**
 * 删除缓存数据 返回结果定义
 * @apiName removeStorage
 */
export interface IUnionRemoveStorageResult {
}
/**
 * 删除缓存数据
 * @apiName removeStorage
 */
export declare function removeStorage$(params: IUnionRemoveStorageParams): Promise<IUnionRemoveStorageResult>;
export default removeStorage$;
