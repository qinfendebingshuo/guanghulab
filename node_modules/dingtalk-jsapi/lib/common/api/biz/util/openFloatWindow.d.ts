export declare const apiName = "biz.util.openFloatWindow";
/**
 * 打开浮层窗口 请求参数定义
 * @apiName biz.util.openFloatWindow
 */
export interface IBizUtilOpenFloatWindowParams {
    [key: string]: any;
}
/**
 * 打开浮层窗口 返回结果定义
 * @apiName biz.util.openFloatWindow
 */
export interface IBizUtilOpenFloatWindowResult {
    [key: string]: any;
}
/**
 * 打开浮层窗口
 * @apiName biz.util.openFloatWindow
 * @supportVersion  ios: 3.2 android: 3.2
 */
export declare function openFloatWindow$(params: IBizUtilOpenFloatWindowParams): Promise<IBizUtilOpenFloatWindowResult>;
export default openFloatWindow$;
