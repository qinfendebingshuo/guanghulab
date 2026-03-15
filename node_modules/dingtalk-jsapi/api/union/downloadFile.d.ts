import { ICommonAPIParams } from '../../constant/types';
/**
 * 下载文件 请求参数定义
 * @apiName downloadFile
 */
export interface IUnionDownloadFileParams extends ICommonAPIParams {
    url: string;
    header?: {};
}
/**
 * 下载文件 返回结果定义
 * @apiName downloadFile
 */
export interface IUnionDownloadFileResult {
    filePath?: string;
}
/**
 * 下载文件
 * @apiName downloadFile
 */
export declare function downloadFile$(params: IUnionDownloadFileParams): Promise<IUnionDownloadFileResult>;
export default downloadFile$;
