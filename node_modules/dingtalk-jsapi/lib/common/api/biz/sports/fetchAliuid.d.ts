export declare const apiName = "biz.sports.fetchAliuid";
/**
 * 阿里体育获取钉钉账号对应的阿里体育uid 请求参数定义
 * @apiName biz.sports.fetchAliuid
 */
export interface IBizSportsFetchAliuidParams {
    [key: string]: any;
}
/**
 * 阿里体育获取钉钉账号对应的阿里体育uid 返回结果定义
 * @apiName biz.sports.fetchAliuid
 */
export interface IBizSportsFetchAliuidResult {
    [key: string]: any;
}
/**
 * 阿里体育获取钉钉账号对应的阿里体育uid
 * @apiName biz.sports.fetchAliuid
 * @supportVersion ios: 4.6.3 android: 4.6.3
 */
export declare function fetchAliuid$(params: IBizSportsFetchAliuidParams): Promise<IBizSportsFetchAliuidResult>;
export default fetchAliuid$;
