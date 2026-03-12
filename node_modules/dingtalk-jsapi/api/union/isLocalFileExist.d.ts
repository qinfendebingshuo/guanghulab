import { ICommonAPIParams } from '../../constant/types';
/**
 * 批量检测本地文件是否存在 请求参数定义
 * @apiName isLocalFileExist
 */
export interface IUnionIsLocalFileExistParams extends ICommonAPIParams {
    url: string;
}
/**
 * 批量检测本地文件是否存在 返回结果定义
 * @apiName isLocalFileExist
 */
export interface IUnionIsLocalFileExistResult {
}
/**
 * 批量检测本地文件是否存在
 * @apiName isLocalFileExist
 */
export declare function isLocalFileExist$(params: IUnionIsLocalFileExistParams): Promise<IUnionIsLocalFileExistResult>;
export default isLocalFileExist$;
