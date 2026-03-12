export declare const apiName = "biz.util.openPrintWnd";
/**
 * 打开钉盘文件打印窗口 请求参数定义
 * @apiName biz.util.openPrintWnd
 */
export interface IBizUtilOpenPrintWndParams {
    /** 钉盘文件参数space_id */
    space: string;
    /** 钉盘文件参数file_id */
    file: string;
    /** 文件类型 */
    fileType?: number;
    /** 是否加密 */
    isEncrypt?: boolean;
    /** 媒体id */
    media: string;
    spm?: string;
}
/**
 * 打开钉盘文件打印窗口 返回结果定义
 * @apiName biz.util.openPrintWnd
 */
export interface IBizUtilOpenPrintWndResult {
}
/**
 * 打开钉盘文件打印窗口
 * @apiName biz.util.openPrintWnd
 * @supportVersion win: 6.0.8 mac: 6.0.8
 * @author win:周镛 mac:伯温
 */
export declare function openPrintWnd$(params: IBizUtilOpenPrintWndParams): Promise<IBizUtilOpenPrintWndResult>;
export default openPrintWnd$;
