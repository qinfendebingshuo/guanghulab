export declare const apiName = "biz.microApp.visualList";
/**
 * 获取当前用户可见的企业开通的微应用信息 请求参数定义
 * @apiName biz.microApp.visualList
 */
export interface IBizMicroAppVisualListParams {
    [key: string]: any;
}
/**
 * 获取当前用户可见的企业开通的微应用信息 返回结果定义
 * @apiName biz.microApp.visualList
 */
export interface IBizMicroAppVisualListResult {
    [key: string]: any;
}
/**
 * 获取当前用户可见的企业开通的微应用信息
 * @apiName biz.microApp.visualList
 * @supportVersion  ios: 3.5.0 android: 3.5.0
 */
export declare function visualList$(params: IBizMicroAppVisualListParams): Promise<IBizMicroAppVisualListResult>;
export default visualList$;
