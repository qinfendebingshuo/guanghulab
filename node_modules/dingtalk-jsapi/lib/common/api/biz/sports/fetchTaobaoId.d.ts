export declare const apiName = "biz.sports.fetchTaobaoId";
/**
 * 阿里体育获取淘宝免登url 请求参数定义
 * @apiName biz.sports.fetchTaobaoId
 */
export interface IBizSportsFetchTaobaoIdParams {
}
/**
 * 阿里体育获取淘宝免登url 返回结果定义
 * @apiName biz.sports.fetchTaobaoId
 */
export interface IBizSportsFetchTaobaoIdResult {
    result: string;
}
/**
 * 阿里体育获取淘宝免登url
 * @apiName biz.sports.fetchTaobaoId
 * @supportVersion ios: 4.5.16 android: 4.5.16
 */
export declare function fetchTaobaoId$(params: IBizSportsFetchTaobaoIdParams): Promise<IBizSportsFetchTaobaoIdResult>;
export default fetchTaobaoId$;
