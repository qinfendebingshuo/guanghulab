export declare const apiName = "biz.navigation.gestures";
/**
 * 配置容器相关手势 请求参数定义
 * @apiName biz.navigation.gestures
 */
export interface IBizNavigationGesturesParams {
    [key: string]: any;
}
/**
 * 配置容器相关手势 返回结果定义
 * @apiName biz.navigation.gestures
 */
export interface IBizNavigationGesturesResult {
    [key: string]: any;
}
/**
 * 配置容器相关手势
 * @apiName biz.navigation.gestures
 * @supportVersion  ios: 3.5.1 android: 3.5.1
 */
export declare function gestures$(params: IBizNavigationGesturesParams): Promise<IBizNavigationGesturesResult>;
export default gestures$;
