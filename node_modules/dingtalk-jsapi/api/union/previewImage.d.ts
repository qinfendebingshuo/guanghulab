import { ICommonAPIParams } from '../../constant/types';
/**
 * 预览图片 请求参数定义
 * @apiName previewImage
 */
export interface IUnionPreviewImageParams extends ICommonAPIParams {
    urls: string[];
    current?: number;
}
/**
 * 预览图片 返回结果定义
 * @apiName previewImage
 */
export interface IUnionPreviewImageResult {
}
/**
 * 预览图片
 * @apiName previewImage
 */
export declare function previewImage$(params: IUnionPreviewImageParams): Promise<IUnionPreviewImageResult>;
export default previewImage$;
