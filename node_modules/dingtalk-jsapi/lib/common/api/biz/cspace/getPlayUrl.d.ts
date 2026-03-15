export declare const apiName = "biz.cspace.getPlayUrl";
/**
 * 获取钉盘文件播放地址（视频&音频） 请求参数定义
 * @apiName biz.cspace.getPlayUrl
 */
export interface IBizCspaceGetPlayUrlParams {
    spaceId: any;
    fileId: any;
}
/**
 * 获取钉盘文件播放地址（视频&音频） 返回结果定义
 * @apiName biz.cspace.getPlayUrl
 */
export interface IBizCspaceGetPlayUrlResult {
    url: string;
    /** 1: 完成（已经获取可播放的url） 2：处理中，转码等  3：错误 */
    status: 1 | 2 | 3;
}
/**
 * 获取钉盘文件播放地址（视频&音频）
 * @apiName biz.cspace.getPlayUrl
 * @supportVersion ios: 4.3.5 android: 4.3.5 pc: 4.3.5
 */
export declare function getPlayUrl$(params: IBizCspaceGetPlayUrlParams): Promise<IBizCspaceGetPlayUrlResult>;
export default getPlayUrl$;
