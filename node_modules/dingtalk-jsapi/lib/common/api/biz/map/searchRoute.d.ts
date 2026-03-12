export declare const apiName = "biz.map.searchRoute";
/**
 * 查询路线 请求参数定义
 * @apiName biz.map.searchRoute
 */
export interface IBizMapSearchRouteParams {
    [key: string]: any;
}
/**
 * 查询路线 返回结果定义
 * @apiName biz.map.searchRoute
 */
export interface IBizMapSearchRouteResult {
    [key: string]: any;
}
/**
 * 查询路线
 * @apiName biz.map.searchRoute
 * @supportVersion  ios: 2.11 android: 2.11
 */
export declare function searchRoute$(params: IBizMapSearchRouteParams): Promise<IBizMapSearchRouteResult>;
export default searchRoute$;
