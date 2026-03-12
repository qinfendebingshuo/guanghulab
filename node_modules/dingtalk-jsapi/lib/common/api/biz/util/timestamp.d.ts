export declare const apiName = "biz.util.timestamp";
/**
 * 获取服务器时间 请求参数定义
 * @apiName biz.util.timestamp
 */
export interface IBizUtilTimestampParams {
    [key: string]: any;
}
/**
 * 获取服务器时间 返回结果定义
 * @apiName biz.util.timestamp
 */
export interface IBizUtilTimestampResult {
    [key: string]: any;
}
/**
 * 获取服务器时间
 * @apiName biz.util.timestamp
 * @supportVersion  ios: 2.9.0 android: 2.9.0
 */
export declare function timestamp$(params: IBizUtilTimestampParams): Promise<IBizUtilTimestampResult>;
export default timestamp$;
