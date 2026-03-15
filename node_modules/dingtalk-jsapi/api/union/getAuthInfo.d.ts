import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取授权信息 请求参数定义
 * @apiName getAuthInfo
 */
export interface IUnionGetAuthInfoParams extends ICommonAPIParams {
    type: number;
    corpId: string;
    clientId: string;
    rpcScope: string[];
    fieldScope: string[];
}
/**
 * 获取授权信息 返回结果定义
 * @apiName getAuthInfo
 */
export interface IUnionGetAuthInfoResult {
    status: boolean;
    authCode: string;
}
/**
 * 获取授权信息
 * @apiName getAuthInfo
 */
export declare function getAuthInfo$(params: IUnionGetAuthInfoParams): Promise<IUnionGetAuthInfoResult>;
export default getAuthInfo$;
