import { ICommonAPIParams } from '../../constant/types';
/**
 * 批量预览钉盘图片 请求参数定义
 * @apiName previewImagesInDingTalkBatch
 */
export interface IUnionPreviewImagesInDingTalkBatchParams extends ICommonAPIParams {
    index?: number;
    images: {
        spaceId: string;
        dentryId: string;
    }[];
}
/**
 * 批量预览钉盘图片 返回结果定义
 * @apiName previewImagesInDingTalkBatch
 */
export interface IUnionPreviewImagesInDingTalkBatchResult {
}
/**
 * 批量预览钉盘图片
 * @apiName previewImagesInDingTalkBatch
 */
export declare function previewImagesInDingTalkBatch$(params: IUnionPreviewImagesInDingTalkBatchParams): Promise<IUnionPreviewImagesInDingTalkBatchResult>;
export default previewImagesInDingTalkBatch$;
