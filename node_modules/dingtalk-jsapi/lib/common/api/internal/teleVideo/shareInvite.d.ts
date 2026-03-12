export declare const apiName = "internal.teleVideo.shareInvite";
/**
 * 视频会议 邀请入会 请求参数定义
 * @apiName internal.teleVideo.shareInvite
 */
export interface IInternalTeleVideoShareInviteParams {
    [key: string]: any;
}
/**
 * 视频会议 邀请入会 返回结果定义
 * @apiName internal.teleVideo.shareInvite
 */
export interface IInternalTeleVideoShareInviteResult {
    [key: string]: any;
}
/**
 * 视频会议 邀请入会
 * @apiName internal.teleVideo.shareInvite
 * @supportVersion ios: 5.0.15 android: 5.0.15
 * @author Android: 峰砺, iOS: 怒龙
 */
export declare function shareInvite$(params: IInternalTeleVideoShareInviteParams): Promise<IInternalTeleVideoShareInviteResult>;
export default shareInvite$;
