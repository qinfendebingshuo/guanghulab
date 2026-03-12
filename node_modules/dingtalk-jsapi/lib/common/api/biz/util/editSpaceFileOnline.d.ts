export declare const apiName = "biz.util.editSpaceFileOnline";
/**
 * 编辑在线文件 请求参数定义
 * @apiName biz.util.editSpaceFileOnline
 */
export interface IBizUtilEditSpaceFileOnlineParams {
    /** 钉盘文件参数space_id */
    space: string;
    /** 钉盘文件参数file_id */
    file: string;
    /** 会话Id */
    cid?: string;
    /** 消息id */
    mid?: string;
    /** 所有者Id */
    owner?: string;
}
/**
 * 编辑在线文件 返回结果定义
 * @apiName biz.util.editSpaceFileOnline
 */
export interface IBizUtilEditSpaceFileOnlineResult {
}
/**
 * 编辑在线文件
 * @apiName biz.util.editSpaceFileOnline
 * @supportVersion win: 6.0.8 mac: 6.0.8
 * @author win:周镛 mac:伯温
 */
export declare function editSpaceFileOnline$(params: IBizUtilEditSpaceFileOnlineParams): Promise<IBizUtilEditSpaceFileOnlineResult>;
export default editSpaceFileOnline$;
