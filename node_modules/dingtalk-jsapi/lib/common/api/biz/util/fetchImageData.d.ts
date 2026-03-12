export declare const apiName = "biz.util.fetchImageData";
/**
 * 在相册中拾取某张图片，对图片数据base64编码后返回给js 请求参数定义
 * @apiName biz.util.fetchImageData
 */
export interface IBizUtilFetchImageDataParams {
    [key: string]: any;
}
/**
 * 在相册中拾取某张图片，对图片数据base64编码后返回给js 返回结果定义
 * @apiName biz.util.fetchImageData
 */
export interface IBizUtilFetchImageDataResult {
    [key: string]: any;
}
/**
 * 在相册中拾取某张图片，对图片数据base64编码后返回给js
 * @apiName biz.util.fetchImageData
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function fetchImageData$(params: IBizUtilFetchImageDataParams): Promise<IBizUtilFetchImageDataResult>;
export default fetchImageData$;
