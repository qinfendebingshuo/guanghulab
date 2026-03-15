export declare const apiName = "biz.contact.isForeignOrg";
/**
 * 判断corpId对应的企业是否是海外企业 请求参数定义
 * @apiName biz.contact.isForeignOrg
 */
export interface IBizContactIsForeignOrgParams {
    [key: string]: any;
}
/**
 * 判断corpId对应的企业是否是海外企业 返回结果定义
 * @apiName biz.contact.isForeignOrg
 */
export interface IBizContactIsForeignOrgResult {
    [key: string]: any;
}
/**
 * 判断corpId对应的企业是否是海外企业
 * @apiName biz.contact.isForeignOrg
 * @supportVersion  ios: 4.2 android: 4.2
 */
export declare function isForeignOrg$(params: IBizContactIsForeignOrgParams): Promise<IBizContactIsForeignOrgResult>;
export default isForeignOrg$;
