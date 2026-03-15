import { ICommonAPIParams } from '../../constant/types';
/**
 * 保存图片到系统相册 请求参数定义
 * @apiName saveImageToPhotosAlbum
 */
export interface IUnionSaveImageToPhotosAlbumParams extends ICommonAPIParams {
    filePath: string;
}
/**
 * 保存图片到系统相册 返回结果定义
 * @apiName saveImageToPhotosAlbum
 */
export interface IUnionSaveImageToPhotosAlbumResult {
}
/**
 * 保存图片到系统相册
 * @apiName saveImageToPhotosAlbum
 */
export declare function saveImageToPhotosAlbum$(params: IUnionSaveImageToPhotosAlbumParams): Promise<IUnionSaveImageToPhotosAlbumResult>;
export default saveImageToPhotosAlbum$;
