export declare const apiName = "biz.util.previewFile";
/**
 * 预览文件 请求参数定义
 * @apiName biz.util.previewFile
 */
export interface IBizUtilPreviewFileParams {
    [key: string]: any;
}
/**
 * 预览文件 返回结果定义
 * @apiName biz.util.previewFile
 */
export interface IBizUtilPreviewFileResult {
    [key: string]: any;
}
/**
 * 预览文件
 * @apiName biz.util.previewFile
 * @supportVersion  pc: 3.0.0
 */
export declare function previewFile$(params: IBizUtilPreviewFileParams): Promise<IBizUtilPreviewFileResult>;
export default previewFile$;
