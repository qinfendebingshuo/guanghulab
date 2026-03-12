export declare const apiName = "biz.faceBox.startCameraRecord";
/**
 * 唤起人脸录入界面 请求参数定义
 * @apiName biz.faceBox.startCameraRecord
 */
export interface IBizFaceBoxStartCameraRecordParams {
    [key: string]: any;
}
/**
 * 唤起人脸录入界面 返回结果定义
 * @apiName biz.faceBox.startCameraRecord
 */
export interface IBizFaceBoxStartCameraRecordResult {
    [key: string]: any;
}
/**
 * 唤起人脸录入界面
 * @apiName biz.faceBox.startCameraRecord
 * @supportVersion  ios: 3.5.4 android: 3.5.4
 */
export declare function startCameraRecord$(params: IBizFaceBoxStartCameraRecordParams): Promise<IBizFaceBoxStartCameraRecordResult>;
export default startCameraRecord$;
