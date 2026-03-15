import { ICommonAPIParams } from '../../../constant/types';
/**
 * 保存图片到系统相册 请求参数定义
 * @apiName biz.util.saveImageToPhotosAlbum
 */
export interface IBizUtilSaveImageToPhotosAlbumParams extends ICommonAPIParams {
    filePath: string;
}
/**
 * 保存图片到系统相册 返回结果定义
 * @apiName biz.util.saveImageToPhotosAlbum
 */
export interface IBizUtilSaveImageToPhotosAlbumResult {
}
/**
 * 保存图片到系统相册
 * @apiName biz.util.saveImageToPhotosAlbum
 */
export declare function saveImageToPhotosAlbum$(params: IBizUtilSaveImageToPhotosAlbumParams): Promise<IBizUtilSaveImageToPhotosAlbumResult>;
export default saveImageToPhotosAlbum$;
