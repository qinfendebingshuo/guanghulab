import { ICommonAPIParams } from '../../../constant/types';
/**
 * 下载文件 请求参数定义
 * @apiName biz.file.downloadFile
 */
export interface IBizFileDownloadFileParams extends ICommonAPIParams {
    url: string;
    header?: {};
}
/**
 * 下载文件 返回结果定义
 * @apiName biz.file.downloadFile
 */
export interface IBizFileDownloadFileResult {
    filePath: string;
}
/**
 * 下载文件
 * @apiName biz.file.downloadFile
 */
export declare function downloadFile$(params: IBizFileDownloadFileParams): Promise<IBizFileDownloadFileResult>;
export default downloadFile$;
