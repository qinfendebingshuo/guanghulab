import { ICommonAPIParams } from '../../constant/types';
/**
 * 预览图片和视频 请求参数定义
 * @apiName previewMedia
 */
export interface IUnionPreviewMediaParams extends ICommonAPIParams {
    current?: number;
    sources: {
        url: string;
        type: string;
        poster?: string;
    }[];
    showmenu?: boolean;
}
/**
 * 预览图片和视频 返回结果定义
 * @apiName previewMedia
 */
export interface IUnionPreviewMediaResult {
}
/**
 * 预览图片和视频
 * @apiName previewMedia
 */
export declare function previewMedia$(params: IUnionPreviewMediaParams): Promise<IUnionPreviewMediaResult>;
export default previewMedia$;
