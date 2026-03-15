export declare const apiName = "biz.navigation.back";
/**
 * 弹窗alert 请求参数定义
 * @apiName biz.navigation.back
 */
export interface IBizNavigationBackParams {
    [key: string]: any;
}
/**
 * 弹窗alert 返回结果定义
 * @apiName biz.navigation.back
 */
export interface IBizNavigationBackResult {
    [key: string]: any;
}
/**
 * 弹窗alert
 * @apiName biz.navigation.back
 * @supportVersion  ios: 2.4.0 android: 2.4.0
 */
export declare function back$(params: IBizNavigationBackParams): Promise<IBizNavigationBackResult>;
export default back$;
