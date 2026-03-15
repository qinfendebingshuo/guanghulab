export declare const apiName = "biz.zoloz.download";
/**
 * 下载算法模型 请求参数定义
 * @apiName biz.zoloz.download
 */
export interface IBizZolozDownloadParams {
    [key: string]: any;
}
/**
 * 下载算法模型 返回结果定义
 * @apiName biz.zoloz.download
 */
export interface IBizZolozDownloadResult {
    [key: string]: any;
}
/**
 * 下载算法模型
 * @apiName biz.zoloz.download
 * @supportVersion  ios: 4.2 android: 4.2
 */
export declare function download$(params: IBizZolozDownloadParams): Promise<IBizZolozDownloadResult>;
export default download$;
