import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取微应用免登授权码 请求参数定义
 * @apiName requestAuthCode
 */
export interface IUnionRequestAuthCodeParams extends ICommonAPIParams {
    corpId: string;
    clientId: string;
}
/**
 * 获取微应用免登授权码 返回结果定义
 * @apiName requestAuthCode
 */
export interface IUnionRequestAuthCodeResult {
    code: string;
}
/**
 * 获取微应用免登授权码
 * @apiName requestAuthCode
 */
export declare function requestAuthCode$(params: IUnionRequestAuthCodeParams): Promise<IUnionRequestAuthCodeResult>;
export default requestAuthCode$;
