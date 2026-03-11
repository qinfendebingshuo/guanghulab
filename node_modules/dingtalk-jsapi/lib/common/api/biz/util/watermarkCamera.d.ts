export declare const apiName = "biz.util.watermarkCamera";
/**
 * 水印打卡相机JSAPI 请求参数定义
 * @apiName biz.util.watermarkCamera
 */
export interface IBizUtilWatermarkCameraParams {
    /** 默认水印id，传-1则，表示默认无水印 */
    defaultWatermarkId?: string;
    /** 业务码 */
    bizCode: string;
    /** 企业ID，与cid必有其一 */
    corpId?: string;
    /** 会话ID，与corpId必有其一 */
    cid?: string;
    /** 是否需要记流水 */
    needCheckIn?: boolean;
    /** 初始化数据，这个数据切换模板的时候会保存，并且传入到模板内 */
    extendData?: any;
}
/**
 * 水印打卡相机JSAPI 返回结果定义
 * @apiName biz.util.watermarkCamera
 */
export interface IBizUtilWatermarkCameraResult {
    /** 水印打卡返回的图片地址 */
    url: string;
    mediaId: string;
    authMediaId: string;
    /** 额外数据，包含入参及表单额外数据 */
    extendData: any;
    /** 表单数据 */
    formDataLists: any;
}
/**
 * 水印打卡相机JSAPI
 * @apiName biz.util.watermarkCamera
 * @supportVersion ios: 5.1.27 android: 5.1.27
 * @author iOS：度尽 Android：序望
 */
export declare function watermarkCamera$(params: IBizUtilWatermarkCameraParams): Promise<IBizUtilWatermarkCameraResult>;
export default watermarkCamera$;
