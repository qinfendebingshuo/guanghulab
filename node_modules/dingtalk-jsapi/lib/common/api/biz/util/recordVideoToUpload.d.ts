export declare const apiName = "biz.util.recordVideoToUpload";
/**
 * 录制视频进行上传 请求参数定义
 * @apiName biz.util.recordVideoToUpload
 */
export interface IBizUtilRecordVideoToUploadParams {
    [key: string]: any;
}
/**
 * 录制视频进行上传 返回结果定义
 * @apiName biz.util.recordVideoToUpload
 */
export interface IBizUtilRecordVideoToUploadResult {
    [key: string]: any;
}
/**
 * 录制视频进行上传
 * @apiName biz.util.recordVideoToUpload
 * @supportVersion  ios: 3.4 android: 3.4
 */
export declare function recordVideoToUpload$(params: IBizUtilRecordVideoToUploadParams): Promise<IBizUtilRecordVideoToUploadResult>;
export default recordVideoToUpload$;
