export declare const apiName = "biz.verify.takePhoto";
/**
 * 拍摄身份证正反面 请求参数定义
 * @apiName biz.verify.takePhoto
 */
export interface IBizVerifyTakePhotoParams {
    [key: string]: any;
}
/**
 * 拍摄身份证正反面 返回结果定义
 * @apiName biz.verify.takePhoto
 */
export interface IBizVerifyTakePhotoResult {
    [key: string]: any;
}
/**
 * 拍摄身份证正反面
 * @apiName biz.verify.takePhoto
 * @supportVersion  ios: 3.5.1 android: 3.5.1
 */
export declare function takePhoto$(params: IBizVerifyTakePhotoParams): Promise<IBizVerifyTakePhotoResult>;
export default takePhoto$;
