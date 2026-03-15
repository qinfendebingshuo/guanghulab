/**
 * 批量预览钉盘图片 请求参数定义
 * @apiName biz.cspace.previewDentryImages
 */
export interface IBizCspacePreviewDentryImagesParams {
    images: {
        spaceId: string;
        dentryId: string;
    }[];
    index?: number;
}
/**
 * 批量预览钉盘图片 返回结果定义
 * @apiName biz.cspace.previewDentryImages
 */
export interface IBizCspacePreviewDentryImagesResult {
}
/**
 * 批量预览钉盘图片
 * @apiName biz.cspace.previewDentryImages
 * @supportVersion ios: 6.3.30 android: 6.3.30
 */
export declare function previewDentryImages$(params: IBizCspacePreviewDentryImagesParams): Promise<IBizCspacePreviewDentryImagesResult>;
export default previewDentryImages$;
