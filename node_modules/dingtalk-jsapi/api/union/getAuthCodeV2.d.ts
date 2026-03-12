import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取微应用免登授权码 请求参数定义
 * @apiName getAuthCodeV2
 */
export interface IUnionGetAuthCodeV2Params extends ICommonAPIParams {
    corpId: string;
    clientId: string;
}
/**
 * 获取微应用免登授权码 返回结果定义
 * @apiName getAuthCodeV2
 */
export interface IUnionGetAuthCodeV2Result {
    code: string;
}
/**
 * 获取微应用免登授权码
 * @apiName getAuthCodeV2
 */
export declare function getAuthCodeV2$(params: IUnionGetAuthCodeV2Params): Promise<IUnionGetAuthCodeV2Result>;
export default getAuthCodeV2$;
