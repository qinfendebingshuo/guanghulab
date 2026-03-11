import { ICommonAPIParams } from '../../constant/types';
/**
 * 上传文件 请求参数定义
 * @apiName uploadFile
 */
export interface IUnionUploadFileParams extends ICommonAPIParams {
    url: string;
    header?: {};
    fileName: string;
    filePath: string;
    fileType: string;
    formData?: {};
}
/**
 * 上传文件 返回结果定义
 * @apiName uploadFile
 */
export interface IUnionUploadFileResult {
    data?: string;
    header?: {};
    statusCode?: string;
}
/**
 * 上传文件
 * @apiName uploadFile
 */
export declare function uploadFile$(params: IUnionUploadFileParams): Promise<IUnionUploadFileResult>;
export default uploadFile$;
