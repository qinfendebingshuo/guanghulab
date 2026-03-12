export declare const apiName = "internal.util.getCorpIdByOrgId";
/**
 * orgId换corpId 请求参数定义
 * @apiName internal.util.getCorpIdByOrgId
 */
export interface IInternalUtilGetCorpIdByOrgIdParams {
    orgId: string;
}
/**
 * orgId换corpId 返回结果定义
 * @apiName internal.util.getCorpIdByOrgId
 */
export declare type IInternalUtilGetCorpIdByOrgIdResult = string;
/**
 * orgId换corpId
 * @apiName internal.util.getCorpIdByOrgId
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function getCorpIdByOrgId$(params: IInternalUtilGetCorpIdByOrgIdParams): Promise<IInternalUtilGetCorpIdByOrgIdResult>;
export default getCorpIdByOrgId$;
