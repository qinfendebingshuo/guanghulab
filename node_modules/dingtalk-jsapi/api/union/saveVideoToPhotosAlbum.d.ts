import { ICommonAPIParams } from '../../constant/types';
/**
 * 保存视频到系统相册 请求参数定义
 * @apiName saveVideoToPhotosAlbum
 */
export interface IUnionSaveVideoToPhotosAlbumParams extends ICommonAPIParams {
    filePath: string;
}
/**
 * 保存视频到系统相册 返回结果定义
 * @apiName saveVideoToPhotosAlbum
 */
export interface IUnionSaveVideoToPhotosAlbumResult {
}
/**
 * 保存视频到系统相册
 * @apiName saveVideoToPhotosAlbum
 */
export declare function saveVideoToPhotosAlbum$(params: IUnionSaveVideoToPhotosAlbumParams): Promise<IUnionSaveVideoToPhotosAlbumResult>;
export default saveVideoToPhotosAlbum$;
