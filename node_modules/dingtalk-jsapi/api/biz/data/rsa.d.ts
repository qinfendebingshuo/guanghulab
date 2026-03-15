import { ICommonAPIParams } from '../../../constant/types';
/**
 * RSA加解密 请求参数定义
 * @apiName biz.data.rsa
 */
export interface IBizDataRsaParams extends ICommonAPIParams {
    key: string;
    text: string;
    action: string;
}
/**
 * RSA加解密 返回结果定义
 * @apiName biz.data.rsa
 */
export interface IBizDataRsaResult {
    text: string;
}
/**
 * RSA加解密
 * @apiName biz.data.rsa
 */
export declare function rsa$(params: IBizDataRsaParams): Promise<IBizDataRsaResult>;
export default rsa$;
