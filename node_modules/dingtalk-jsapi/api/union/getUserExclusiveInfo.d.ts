import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取钉钉客户端是否为专属钉钉 请求参数定义
 * @apiName getUserExclusiveInfo
 */
export interface IUnionGetUserExclusiveInfoParams extends ICommonAPIParams {
}
/**
 * 获取钉钉客户端是否为专属钉钉 返回结果定义
 * @apiName getUserExclusiveInfo
 */
export interface IUnionGetUserExclusiveInfoResult {
    isExclusiveApp: number;
}
/**
 * 获取钉钉客户端是否为专属钉钉
 * @apiName getUserExclusiveInfo
 */
export declare function getUserExclusiveInfo$(params: IUnionGetUserExclusiveInfoParams): Promise<IUnionGetUserExclusiveInfoResult>;
export default getUserExclusiveInfo$;
