export declare const apiName = "biz.faceBox.removeFace";
/**
 * 删除已录入的人脸接口 请求参数定义
 * @apiName biz.faceBox.removeFace
 */
export interface IBizFaceBoxRemoveFaceParams {
    [key: string]: any;
}
/**
 * 删除已录入的人脸接口 返回结果定义
 * @apiName biz.faceBox.removeFace
 */
export interface IBizFaceBoxRemoveFaceResult {
    [key: string]: any;
}
/**
 * 删除已录入的人脸接口
 * @apiName biz.faceBox.removeFace
 * @supportVersion  ios: 3.5.4 android: 3.5.4
 */
export declare function removeFace$(params: IBizFaceBoxRemoveFaceParams): Promise<IBizFaceBoxRemoveFaceResult>;
export default removeFace$;
