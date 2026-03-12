export declare const apiName = "biz.util.openShareDpFileWnd";
/**
 * 打开钉盘文档分享窗口 请求参数定义
 * @apiName biz.util.openShareDpFileWnd
 */
export interface IBizUtilOpenShareDpFileWndParams {
    /** 钉盘文件参数space_id */
    space: string;
    /** 钉盘文件参数file_id */
    file: string;
}
/**
 * 打开钉盘文档分享窗口 返回结果定义
 * @apiName biz.util.openShareDpFileWnd
 */
export interface IBizUtilOpenShareDpFileWndResult {
}
/**
 * 打开钉盘文档分享窗口
 * @apiName biz.util.openShareDpFileWnd
 * @supportVersion ios: win: 6.0.8 mac: 6.0.8
 * @author win:周镛 mac:伯温
 */
export declare function openShareDpFileWnd$(params: IBizUtilOpenShareDpFileWndParams): Promise<IBizUtilOpenShareDpFileWndResult>;
export default openShareDpFileWnd$;
