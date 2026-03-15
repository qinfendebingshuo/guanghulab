export declare const apiName = "biz.navigation.setPullGesture";
/**
 * 设置当前页面(容器实例)是否支持设置收纳到缩略图功能 请求参数定义
 * @apiName biz.navigation.setPullGesture
 */
export interface IBizNavigationSetPullGestureParams {
    [key: string]: any;
}
/**
 * 设置当前页面(容器实例)是否支持设置收纳到缩略图功能 返回结果定义
 * @apiName biz.navigation.setPullGesture
 */
export interface IBizNavigationSetPullGestureResult {
    [key: string]: any;
}
/**
 * 设置当前页面(容器实例)是否支持设置收纳到缩略图功能
 * @apiName biz.navigation.setPullGesture
 * @supportVersion  ios: 4.2 android: 4.2
 */
export declare function setPullGesture$(params: IBizNavigationSetPullGestureParams): Promise<IBizNavigationSetPullGestureResult>;
export default setPullGesture$;
