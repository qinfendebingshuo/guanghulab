export declare const apiName = "biz.util.qrcode";
/**
 * 弹窗alert 请求参数定义
 * @apiName biz.util.qrcode
 */
export interface IBizUtilQrcodeParams {
    [key: string]: any;
}
/**
 * 弹窗alert 返回结果定义
 * @apiName biz.util.qrcode
 */
export interface IBizUtilQrcodeResult {
    [key: string]: any;
}
/**
 * 弹窗alert
 * @apiName biz.util.qrcode
 * @supportVersion  ios: 2.4.0 android: 2.4.0
 */
export declare function qrcode$(params: IBizUtilQrcodeParams): Promise<IBizUtilQrcodeResult>;
export default qrcode$;
