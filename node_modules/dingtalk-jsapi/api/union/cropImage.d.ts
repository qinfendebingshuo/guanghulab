import { ICommonAPIParams } from '../../constant/types';
/**
 * 图片剪裁 请求参数定义
 * @apiName cropImage
 */
export interface IUnionCropImageParams extends ICommonAPIParams {
    keepPNG?: boolean;
    filePath: string;
    aspectRatio: number;
}
/**
 * 图片剪裁 返回结果定义
 * @apiName cropImage
 */
export interface IUnionCropImageResult {
    path: string;
    size: number;
    fileType: string;
}
/**
 * 图片剪裁
 * @apiName cropImage
 */
export declare function cropImage$(params: IUnionCropImageParams): Promise<IUnionCropImageResult>;
export default cropImage$;
