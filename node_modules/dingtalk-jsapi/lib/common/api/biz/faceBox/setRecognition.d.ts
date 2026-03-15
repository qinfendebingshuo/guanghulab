export declare const apiName = "biz.faceBox.setRecognition";
/**
 * 设置当前设备模式 请求参数定义
 * @apiName biz.faceBox.setRecognition
 */
export interface IBizFaceBoxSetRecognitionParams {
    [key: string]: any;
}
/**
 * 设置当前设备模式 返回结果定义
 * @apiName biz.faceBox.setRecognition
 */
export interface IBizFaceBoxSetRecognitionResult {
    [key: string]: any;
}
/**
 * 设置当前设备模式
 * @apiName biz.faceBox.setRecognition
 * @supportVersion  ios: 3.5.4 android: 3.5.4
 */
export declare function setRecognition$(params: IBizFaceBoxSetRecognitionParams): Promise<IBizFaceBoxSetRecognitionResult>;
export default setRecognition$;
