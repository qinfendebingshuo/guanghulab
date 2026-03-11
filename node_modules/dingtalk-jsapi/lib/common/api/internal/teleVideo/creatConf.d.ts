export declare const apiName = "internal.teleVideo.creatConf";
/**
 * 发起视频会议 请求参数定义
 * @apiName internal.teleVideo.creatConf
 */
export interface IInternalTeleVideoCreatConfParams {
    /** 视频会议类型 */
    bizType: string;
    /** 最大支持人数 */
    maxUsers: number;
    /** 呼叫用户 */
    calleeUsers: string[];
    /** 本地设备uid */
    localDevice: number;
}
/**
 * 发起视频会议 返回结果定义
 * @apiName internal.teleVideo.creatConf
 */
export interface IInternalTeleVideoCreatConfResult {
}
/**
 * 发起视频会议
 * @apiName internal.teleVideo.creatConf
 * @supportVersion ios: 4.6.34 android: 4.6.34
 */
export declare function creatConf$(params: IInternalTeleVideoCreatConfParams): Promise<IInternalTeleVideoCreatConfResult>;
export default creatConf$;
