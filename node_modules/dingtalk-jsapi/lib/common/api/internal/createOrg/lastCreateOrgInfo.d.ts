export declare const apiName = "internal.createOrg.lastCreateOrgInfo";
/**
 * 获取最近创建的团队信息 请求参数定义
 * @apiName internal.createOrg.lastCreateOrgInfo
 */
export interface IInternalCreateOrgLastCreateOrgInfoParams {
    [key: string]: any;
}
/**
 * 获取最近创建的团队信息 返回结果定义
 * @apiName internal.createOrg.lastCreateOrgInfo
 */
export interface IInternalCreateOrgLastCreateOrgInfoResult {
    [key: string]: any;
}
/**
 * 获取最近创建的团队信息
 * @apiName internal.createOrg.lastCreateOrgInfo
 * @supportVersion  ios: 3.5.1 android: 3.5.1
 */
export declare function lastCreateOrgInfo$(params: IInternalCreateOrgLastCreateOrgInfoParams): Promise<IInternalCreateOrgLastCreateOrgInfoResult>;
export default lastCreateOrgInfo$;
