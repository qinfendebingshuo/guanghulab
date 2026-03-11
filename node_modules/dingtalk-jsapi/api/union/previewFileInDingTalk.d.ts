import { ICommonAPIParams } from '../../constant/types';
/**
 * 钉盘文件预览 请求参数定义
 * @apiName previewFileInDingTalk
 */
export interface IUnionPreviewFileInDingTalkParams extends ICommonAPIParams {
    corpId?: string;
    fileId: string;
    spaceId: string;
    fileName: string;
    fileSize: string;
    fileType: string;
}
/**
 * 钉盘文件预览 返回结果定义
 * @apiName previewFileInDingTalk
 */
export interface IUnionPreviewFileInDingTalkResult {
}
/**
 * 钉盘文件预览
 * @apiName previewFileInDingTalk
 */
export declare function previewFileInDingTalk$(params: IUnionPreviewFileInDingTalkParams): Promise<IUnionPreviewFileInDingTalkResult>;
export default previewFileInDingTalk$;
