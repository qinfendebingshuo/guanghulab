import { ICommonAPIParams } from '../../constant/types';
/**
 * 免登授权码 请求参数定义
 * @apiName getAuthCode
 */
export interface IUnionGetAuthCodeParams extends ICommonAPIParams {
    corpId: string;
}
/**
 * 免登授权码 返回结果定义
 * @apiName getAuthCode
 */
export interface IUnionGetAuthCodeResult {
    authCode: string;
}
/**
 * 免登授权码
 * @apiName getAuthCode
 */
export declare function getAuthCode$(params: IUnionGetAuthCodeParams): Promise<IUnionGetAuthCodeResult>;
export default getAuthCode$;
