import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取当前组织的corpid 请求参数定义
 * @apiName getCurrentCorpId
 */
export interface IUnionGetCurrentCorpIdParams extends ICommonAPIParams {
}
/**
 * 获取当前组织的corpid 返回结果定义
 * @apiName getCurrentCorpId
 */
export interface IUnionGetCurrentCorpIdResult {
    corpId: string;
}
/**
 * 获取当前组织的corpid
 * @apiName getCurrentCorpId
 */
export declare function getCurrentCorpId$(params: IUnionGetCurrentCorpIdParams): Promise<IUnionGetCurrentCorpIdResult>;
export default getCurrentCorpId$;
