export declare const apiName = "biz.faceBox.startPictureRecord";
/**
 * 唤起图片选择界面然后检测人脸 请求参数定义
 * @apiName biz.faceBox.startPictureRecord
 */
export interface IBizFaceBoxStartPictureRecordParams {
    [key: string]: any;
}
/**
 * 唤起图片选择界面然后检测人脸 返回结果定义
 * @apiName biz.faceBox.startPictureRecord
 */
export interface IBizFaceBoxStartPictureRecordResult {
    [key: string]: any;
}
/**
 * 唤起图片选择界面然后检测人脸
 * @apiName biz.faceBox.startPictureRecord
 * @supportVersion  ios: 3.5.4 android: 3.5.4
 */
export declare function startPictureRecord$(params: IBizFaceBoxStartPictureRecordParams): Promise<IBizFaceBoxStartPictureRecordResult>;
export default startPictureRecord$;
