export declare const apiName = "internal.certify.takePhoto";
/**
 * 拍照 请求参数定义
 * @apiName internal.certify.takePhoto
 */
export interface IInternalCertifyTakePhotoParams {
    [key: string]: any;
}
/**
 * 拍照 返回结果定义
 * @apiName internal.certify.takePhoto
 */
export interface IInternalCertifyTakePhotoResult {
    [key: string]: any;
}
/**
 * 拍照
 * @apiName internal.certify.takePhoto
 * @supportVersion  ios: 2.12.0 android: 2.12.0
 */
export declare function takePhoto$(params: IInternalCertifyTakePhotoParams): Promise<IInternalCertifyTakePhotoResult>;
export default takePhoto$;
