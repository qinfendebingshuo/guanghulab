export declare const apiName = "internal.request.getOrgFeatureByKey";
/**
 * corpId换orgId 请求参数定义
 * @apiName internal.request.getOrgFeatureByKey
 */
export interface IInternalRequestGetOrgFeatureByKeyParams {
    [key: string]: any;
}
/**
 * corpId换orgId 返回结果定义
 * @apiName internal.request.getOrgFeatureByKey
 */
export interface IInternalRequestGetOrgFeatureByKeyResult {
    [key: string]: any;
}
/**
 * corpId换orgId
 * @apiName internal.request.getOrgFeatureByKey
 * @supportVersion  pc: 3.4.0
 */
export declare function getOrgFeatureByKey$(params: IInternalRequestGetOrgFeatureByKeyParams): Promise<IInternalRequestGetOrgFeatureByKeyResult>;
export default getOrgFeatureByKey$;
