export declare const apiName = "internal.user.allOrganizations";
/**
 * 获取自己所在的所有企业基本信息 请求参数定义
 * @apiName internal.user.allOrganizations
 */
export interface IInternalUserAllOrganizationsParams {
    [key: string]: any;
}
/**
 * 获取自己所在的所有企业基本信息 返回结果定义
 * @apiName internal.user.allOrganizations
 */
export interface IInternalUserAllOrganizationsResult {
    [key: string]: any;
}
/**
 * 获取自己所在的所有企业基本信息
 * @apiName internal.user.allOrganizations
 * @supportVersion  ios: 3.5.0 android: 3.5.0
 */
export declare function allOrganizations$(params: IInternalUserAllOrganizationsParams): Promise<IInternalUserAllOrganizationsResult>;
export default allOrganizations$;
