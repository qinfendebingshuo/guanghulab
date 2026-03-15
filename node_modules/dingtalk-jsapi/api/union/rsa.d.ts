import { ICommonAPIParams } from '../../constant/types';
/**
 * RSA加解密 请求参数定义
 * @apiName rsa
 */
export interface IUnionRsaParams extends ICommonAPIParams {
    key: string;
    text: string;
    action: string;
}
/**
 * RSA加解密 返回结果定义
 * @apiName rsa
 */
export interface IUnionRsaResult {
    text: string;
}
/**
 * RSA加解密
 * @apiName rsa
 */
export declare function rsa$(params: IUnionRsaParams): Promise<IUnionRsaResult>;
export default rsa$;
