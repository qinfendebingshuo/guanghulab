import { ICommonAPIParams } from '../../constant/types';
/**
 * 上传附件到钉盘/从钉盘选择文件 请求参数定义
 * @apiName uploadAttachmentToDingTalk
 */
export interface IUnionUploadAttachmentToDingTalkParams extends ICommonAPIParams {
    file: {
        max?: number;
        spaceId: string;
        folderId: string;
    };
    image?: {
        max?: number;
        spaceId: string;
        compress?: boolean;
        folderId: string;
        multiple?: boolean;
    };
    space: {
        max?: number;
        corpId: string;
        isCopy?: boolean;
        spaceId: string;
        folderId: string;
    };
    types: string[];
}
/**
 * 上传附件到钉盘/从钉盘选择文件 返回结果定义
 * @apiName uploadAttachmentToDingTalk
 */
export interface IUnionUploadAttachmentToDingTalkResult {
    data: {
        fileId: string;
        spaceId: string;
        fileName: string;
        fileSize: string;
        fileType: string;
    };
    type: string;
}
/**
 * 上传附件到钉盘/从钉盘选择文件
 * @apiName uploadAttachmentToDingTalk
 */
export declare function uploadAttachmentToDingTalk$(params: IUnionUploadAttachmentToDingTalkParams): Promise<IUnionUploadAttachmentToDingTalkResult>;
export default uploadAttachmentToDingTalk$;
