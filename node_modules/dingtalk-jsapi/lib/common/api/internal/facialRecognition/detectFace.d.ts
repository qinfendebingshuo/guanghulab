export declare const apiName = "internal.facialRecognition.detectFace";
/**
 * 人脸的识别 请求参数定义
 * @apiName internal.facialRecognition.detectFace
 */
export interface IInternalFacialRecognitionDetectFaceParams {
    [key: string]: any;
}
/**
 * 人脸的识别 返回结果定义
 * @apiName internal.facialRecognition.detectFace
 */
export interface IInternalFacialRecognitionDetectFaceResult {
    [key: string]: any;
}
/**
 * 人脸的识别
 * @apiName internal.facialRecognition.detectFace
 * @supportVersion  ios: 3.5.6 android: 3.5.6
 */
export declare function detectFace$(params: IInternalFacialRecognitionDetectFaceParams): Promise<IInternalFacialRecognitionDetectFaceResult>;
export default detectFace$;
