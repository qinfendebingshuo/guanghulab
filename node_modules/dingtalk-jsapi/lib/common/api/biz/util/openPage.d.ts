export declare const apiName = "biz.util.openPage";
/**
 * 用于打开客户端指定的 Native 页面 请求参数定义
 * @apiName biz.util.openPage
 */
export interface IBizUtilOpenPageParams {
    name: string;
    params?: {
        [key: string]: any;
    };
}
/**
 * 用于打开客户端指定的 Native 页面 返回结果定义
 * @apiName biz.util.openPage
 */
export interface IBizUtilOpenPageResult {
    [key: string]: any;
}
/**
 * 用于打开客户端指定的 Native 页面
 * @apiName biz.util.openPage
 * @supportVersion ios: 2.7.0 android: 2.7.0
 */
export declare function openPage$(params: IBizUtilOpenPageParams): Promise<IBizUtilOpenPageResult>;
export default openPage$;
