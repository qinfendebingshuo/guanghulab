/**
 * 启动H5应用 请求参数定义
 * @apiName biz.navigation.navigateToPage
 */
export interface IBizNavigationNavigateToPageParams {
    [key: string]: any;
}
/**
 * 启动H5应用 返回结果定义
 * @apiName biz.navigation.navigateToPage
 */
export interface IBizNavigationNavigateToPageResult {
    [key: string]: any;
}
/**
 * 启动H5应用
 * @apiName biz.navigation.navigateToPage
 * @supportVersion ios: 6.5.31 android: 6.5.31
 */
export declare function navigateToPage$(params: IBizNavigationNavigateToPageParams): Promise<IBizNavigationNavigateToPageResult>;
export default navigateToPage$;
