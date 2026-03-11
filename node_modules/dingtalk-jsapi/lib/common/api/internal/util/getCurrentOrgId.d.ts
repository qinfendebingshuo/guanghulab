export declare const apiName = "internal.util.getCurrentOrgId";
/**
 * 获取当前组织的OrgID 请求参数定义
 * @apiName internal.util.getCurrentOrgId
 */
export interface IInternalUtilGetCurrentOrgIdParams {
}
/**
 * 获取当前组织的OrgID 返回结果定义
 * @apiName internal.util.getCurrentOrgId
 */
export interface IInternalUtilGetCurrentOrgIdResult {
    orgId: string;
}
/**
 * 获取当前组织的OrgID
 * @apiName internal.util.getCurrentOrgId
 * @supportVersion ios: 5.1.39 android: 5.1.39
 * @author windows: 口合, mac: 口合
 */
export declare function getCurrentOrgId$(params: IInternalUtilGetCurrentOrgIdParams): Promise<IInternalUtilGetCurrentOrgIdResult>;
export default getCurrentOrgId$;
