/**
 * 从H5应用返回 请求参数定义
 * @apiName biz.navigation.navigateBackPage
 */
export interface IBizNavigationNavigateBackPageParams {
    [key: string]: any;
}
/**
 * 从H5应用返回 返回结果定义
 * @apiName biz.navigation.navigateBackPage
 */
export interface IBizNavigationNavigateBackPageResult {
    [key: string]: any;
}
/**
 * 从H5应用返回
 * @apiName biz.navigation.navigateBackPage
 * @supportVersion ios: 6.5.31 android: 6.5.31
 */
export declare function navigateBackPage$(params: IBizNavigationNavigateBackPageParams): Promise<IBizNavigationNavigateBackPageResult>;
export default navigateBackPage$;
