import { ICommonAPIParams } from '../../constant/types';
/**
 * 专属实人认证 请求参数定义
 * @apiName exclusiveLiveCheck
 */
export interface IUnionExclusiveLiveCheckParams extends ICommonAPIParams {
    corpId: string;
    agentId: string;
}
/**
 * 专属实人认证 返回结果定义
 * @apiName exclusiveLiveCheck
 */
export interface IUnionExclusiveLiveCheckResult {
    photoStatus: number;
}
/**
 * 专属实人认证
 * @apiName exclusiveLiveCheck
 */
export declare function exclusiveLiveCheck$(params: IUnionExclusiveLiveCheckParams): Promise<IUnionExclusiveLiveCheckResult>;
export default exclusiveLiveCheck$;
