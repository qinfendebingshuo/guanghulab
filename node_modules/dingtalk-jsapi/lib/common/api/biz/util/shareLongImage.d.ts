export declare const apiName = "biz.util.shareLongImage";
/**
 * 分享长图 请求参数定义
 * @apiName biz.util.shareLongImage
 */
export interface IBizUtilShareLongImageParams {
}
/**
 * 分享长图 返回结果定义
 * @apiName biz.util.shareLongImage
 */
export interface IBizUtilShareLongImageResult {
    [key: string]: any;
}
/**
 * 分享长图
 * @description 提供给日志等需要长图分享的业务场景
 * @apiName biz.util.shareLongImage
 * @supportVersion ios: 6.0.0 android: 6.0.0
 * @author iOS: 贾逵
 */
export declare function shareLongImage$(params: IBizUtilShareLongImageParams): Promise<IBizUtilShareLongImageResult>;
export default shareLongImage$;
