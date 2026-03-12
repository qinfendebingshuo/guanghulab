export declare const apiName = "internal.blebusiness.currentMainOrgId";
/**
 * 获取当前用户的主企业orgId信息 请求参数定义
 * @apiName internal.blebusiness.currentMainOrgId
 */
export interface IInternalBlebusinessCurrentMainOrgIdParams {
}
/**
 * 获取当前用户的主企业orgId信息 返回结果定义
 * @apiName internal.blebusiness.currentMainOrgId
 */
export interface IInternalBlebusinessCurrentMainOrgIdResult {
    mainOrgId: number;
}
/**
 * 获取当前用户的主企业orgId信息
 * @apiName internal.blebusiness.currentMainOrgId
 * @supportVersion ios: 4.6.18
 */
export declare function currentMainOrgId$(params: IInternalBlebusinessCurrentMainOrgIdParams): Promise<IInternalBlebusinessCurrentMainOrgIdResult>;
export default currentMainOrgId$;
