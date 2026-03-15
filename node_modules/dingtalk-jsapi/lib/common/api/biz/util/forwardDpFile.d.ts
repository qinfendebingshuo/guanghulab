export declare const apiName = "biz.util.forwardDpFile";
/**
 * 转发钉盘文件 请求参数定义
 * @apiName biz.util.forwardDpFile
 */
export interface IBizUtilForwardDpFileParams {
    /** 钉盘文件参数space_id */
    space: string;
    /** 钉盘文件参数file_id */
    file: string;
    /** 钉盘文件名称 */
    name?: string;
    /** 优先级 */
    priority?: string;
    /** 组织id */
    orgId?: string;
    /** 是否加密 */
    isEncrypt?: boolean;
    /** 媒体id */
    isFolder?: boolean;
}
/**
 * 转发钉盘文件 返回结果定义
 * @apiName biz.util.forwardDpFile
 */
export interface IBizUtilForwardDpFileResult {
}
/**
 * 转发钉盘文件
 * @apiName biz.util.forwardDpFile
 * @supportVersion win: 6.0.8 mac: 6.0.8
 * @author win:周镛 mac:伯温
 */
export declare function forwardDpFile$(params: IBizUtilForwardDpFileParams): Promise<IBizUtilForwardDpFileResult>;
export default forwardDpFile$;
