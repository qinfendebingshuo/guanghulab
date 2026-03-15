export declare const apiName = "biz.faceBox.getRecognition";
/**
 * 获取当前设备模式 请求参数定义
 * @apiName biz.faceBox.getRecognition
 */
export interface IBizFaceBoxGetRecognitionParams {
    [key: string]: any;
}
/**
 * 获取当前设备模式 返回结果定义
 * @apiName biz.faceBox.getRecognition
 */
export interface IBizFaceBoxGetRecognitionResult {
    [key: string]: any;
}
/**
 * 获取当前设备模式
 * @apiName biz.faceBox.getRecognition
 * @supportVersion  ios: 3.5.4 android: 3.5.4
 */
export declare function getRecognition$(params: IBizFaceBoxGetRecognitionParams): Promise<IBizFaceBoxGetRecognitionResult>;
export default getRecognition$;
