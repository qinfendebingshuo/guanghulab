export declare const apiName = "internal.createOrg.industryInfo";
/**
 * 获取创建团队之后的行业信息 请求参数定义
 * @apiName internal.createOrg.industryInfo
 */
export interface IInternalCreateOrgIndustryInfoParams {
    [key: string]: any;
}
/**
 * 获取创建团队之后的行业信息 返回结果定义
 * @apiName internal.createOrg.industryInfo
 */
export interface IInternalCreateOrgIndustryInfoResult {
    [key: string]: any;
}
/**
 * 获取创建团队之后的行业信息
 * @apiName internal.createOrg.industryInfo
 * @supportVersion  ios: 2.9.0 android: 2.9.0
 */
export declare function industryInfo$(params: IInternalCreateOrgIndustryInfoParams): Promise<IInternalCreateOrgIndustryInfoResult>;
export default industryInfo$;
