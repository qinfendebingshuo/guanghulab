export declare const apiName = "biz.navigation.popGesture";
/**
 * 未知 请求参数定义
 * @apiName biz.navigation.popGesture
 */
export interface IBizNavigationPopGestureParams {
    [key: string]: any;
}
/**
 * 未知 返回结果定义
 * @apiName biz.navigation.popGesture
 */
export interface IBizNavigationPopGestureResult {
    [key: string]: any;
}
/**
 * 未知
 * @apiName biz.navigation.popGesture
 * @supportVersion  ios: 2.7.6 android: 2.7.6
 */
export declare function popGesture$(params: IBizNavigationPopGestureParams): Promise<IBizNavigationPopGestureResult>;
export default popGesture$;
