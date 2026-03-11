import { ICommonAPIParams } from '../../constant/types';
/**
 * 数据解密	 请求参数定义
 * @apiName decrypt
 */
export interface IUnionDecryptParams extends ICommonAPIParams {
}
/**
 * 数据解密	 返回结果定义
 * @apiName decrypt
 */
export interface IUnionDecryptResult {
}
/**
 * 数据解密
 * @apiName decrypt
 */
export declare function decrypt$(params: IUnionDecryptParams): Promise<IUnionDecryptResult>;
export default decrypt$;
