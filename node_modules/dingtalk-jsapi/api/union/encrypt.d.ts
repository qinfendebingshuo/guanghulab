import { ICommonAPIParams } from '../../constant/types';
/**
 * 数据加密	 请求参数定义
 * @apiName encrypt
 */
export interface IUnionEncryptParams extends ICommonAPIParams {
}
/**
 * 数据加密	 返回结果定义
 * @apiName encrypt
 */
export interface IUnionEncryptResult {
}
/**
 * 数据加密
 * @apiName encrypt
 */
export declare function encrypt$(params: IUnionEncryptParams): Promise<IUnionEncryptResult>;
export default encrypt$;
