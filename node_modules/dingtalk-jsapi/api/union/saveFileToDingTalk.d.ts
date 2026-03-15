import { ICommonAPIParams } from '../../constant/types';
/**
 * 转存文件到钉盘 请求参数定义
 * @apiName saveFileToDingTalk
 */
export interface IUnionSaveFileToDingTalkParams extends ICommonAPIParams {
    url: string;
    name: string;
}
/**
 * 转存文件到钉盘 返回结果定义
 * @apiName saveFileToDingTalk
 */
export interface IUnionSaveFileToDingTalkResult {
    data: {
        fileId: string;
        spaceId: string;
        fileName: string;
        fileSize: string;
        fileType: string;
    }[];
}
/**
 * 转存文件到钉盘
 * @apiName saveFileToDingTalk
 */
export declare function saveFileToDingTalk$(params: IUnionSaveFileToDingTalkParams): Promise<IUnionSaveFileToDingTalkResult>;
export default saveFileToDingTalk$;
