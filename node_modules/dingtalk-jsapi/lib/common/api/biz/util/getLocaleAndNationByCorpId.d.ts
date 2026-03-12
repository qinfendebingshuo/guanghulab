export declare const apiName = "biz.util.getLocaleAndNationByCorpId";
/**
 * 通过corpId获取对应企业所在的国家和语言 请求参数定义
 * @apiName biz.util.getLocaleAndNationByCorpId
 */
export interface IBizUtilGetLocaleAndNationByCorpIdParams {
    [key: string]: any;
}
/**
 * 通过corpId获取对应企业所在的国家和语言 返回结果定义
 * @apiName biz.util.getLocaleAndNationByCorpId
 */
export interface IBizUtilGetLocaleAndNationByCorpIdResult {
    [key: string]: any;
}
/**
 * 通过corpId获取对应企业所在的国家和语言
 * @apiName biz.util.getLocaleAndNationByCorpId
 * @supportVersion  ios: 3.5.3 android: 3.5.3
 */
export declare function getLocaleAndNationByCorpId$(params: IBizUtilGetLocaleAndNationByCorpIdParams): Promise<IBizUtilGetLocaleAndNationByCorpIdResult>;
export default getLocaleAndNationByCorpId$;
