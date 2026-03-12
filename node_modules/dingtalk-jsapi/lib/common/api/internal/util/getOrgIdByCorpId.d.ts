export declare const apiName = "internal.util.getOrgIdByCorpId";
/**
 * corpId换orgId 请求参数定义
 * @apiName internal.util.getOrgIdByCorpId
 */
export interface IInternalUtilGetOrgIdByCorpIdParams {
    corpId: string;
}
/**
 * corpId换orgId 返回结果定义
 * @apiName internal.util.getOrgIdByCorpId
 */
export declare type IInternalUtilGetOrgIdByCorpIdResult = string;
/**
 * corpId换orgId
 * @apiName internal.util.getOrgIdByCorpId
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function getOrgIdByCorpId$(params: IInternalUtilGetOrgIdByCorpIdParams): Promise<IInternalUtilGetOrgIdByCorpIdResult>;
export default getOrgIdByCorpId$;
