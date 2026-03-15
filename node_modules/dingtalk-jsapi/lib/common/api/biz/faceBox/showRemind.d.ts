export declare const apiName = "biz.faceBox.showRemind";
/**
 * 提醒用户录入人脸 请求参数定义
 * @apiName biz.faceBox.showRemind
 */
export interface IBizFaceBoxShowRemindParams {
    [key: string]: any;
}
/**
 * 提醒用户录入人脸 返回结果定义
 * @apiName biz.faceBox.showRemind
 */
export interface IBizFaceBoxShowRemindResult {
    [key: string]: any;
}
/**
 * 提醒用户录入人脸
 * @apiName biz.faceBox.showRemind
 * @supportVersion  ios: 3.5.4 android: 3.5.4
 */
export declare function showRemind$(params: IBizFaceBoxShowRemindParams): Promise<IBizFaceBoxShowRemindResult>;
export default showRemind$;
