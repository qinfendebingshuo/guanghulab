export declare const apiName = "biz.sports.fetchTaobaoH5TrustLoginUrlForAlisports";
/**
 * 阿里体育获取淘宝免登url 请求参数定义
 * @apiName biz.sports.fetchTaobaoH5TrustLoginUrlForAlisports
 */
export interface IBizSportsFetchTaobaoH5TrustLoginUrlForAlisportsParams {
    targetUrl: string;
    failedTargetUrl: string;
}
/**
 * 阿里体育获取淘宝免登url 返回结果定义
 * @apiName biz.sports.fetchTaobaoH5TrustLoginUrlForAlisports
 */
export interface IBizSportsFetchTaobaoH5TrustLoginUrlForAlisportsResult {
    result: string;
}
/**
 * 阿里体育获取淘宝免登url
 * @apiName biz.sports.fetchTaobaoH5TrustLoginUrlForAlisports
 * @supportVersion ios: 4.5.16 android: 4.5.16
 */
export declare function fetchTaobaoH5TrustLoginUrlForAlisports$(params: IBizSportsFetchTaobaoH5TrustLoginUrlForAlisportsParams): Promise<IBizSportsFetchTaobaoH5TrustLoginUrlForAlisportsResult>;
export default fetchTaobaoH5TrustLoginUrlForAlisports$;
