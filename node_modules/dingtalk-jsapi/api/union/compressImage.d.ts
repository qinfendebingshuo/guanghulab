import { ICommonAPIParams } from '../../constant/types';
/**
 * 压缩图片 请求参数定义
 * @apiName compressImage
 */
export interface IUnionCompressImageParams extends ICommonAPIParams {
    filePaths: string[];
    compressLevel: number;
}
/**
 * 压缩图片 返回结果定义
 * @apiName compressImage
 */
export interface IUnionCompressImageResult {
    filePaths: string[];
}
/**
 * 压缩图片
 * @apiName compressImage
 */
export declare function compressImage$(params: IUnionCompressImageParams): Promise<IUnionCompressImageResult>;
export default compressImage$;
