export declare const apiName = "biz.navigation.showPopdownList";
/**
 * navigationBar展示下拉列表 请求参数定义
 * @apiName biz.navigation.showPopdownList
 */
export interface IBizNavigationShowPopdownListParams {
    [key: string]: any;
}
/**
 * navigationBar展示下拉列表 返回结果定义
 * @apiName biz.navigation.showPopdownList
 */
export interface IBizNavigationShowPopdownListResult {
    [key: string]: any;
}
/**
 * navigationBar展示下拉列表
 * @apiName biz.navigation.showPopdownList
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function showPopdownList$(params: IBizNavigationShowPopdownListParams): Promise<IBizNavigationShowPopdownListResult>;
export default showPopdownList$;
