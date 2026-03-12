export declare const apiName = "biz.conference.videoCall";
/**
 * 受信任的二方，可以使用该接口，向指定用户发起视频通话 请求参数定义
 * @apiName biz.conference.videoCall
 */
export interface IBizConferenceVideoCallParams {
    /**  通话主题，建议传入有实际意义的简短描述，便于之后查看通话记录时快速筛选 | 必填 */
    title: string;
    /** 主叫昵称 | 必填 */
    callerNick: string;
    /** 调用 api 的业务标识，由小程序自己定义。 | 必填 */
    bizType: string;
    /** 被叫的所属企业id | 必填 */
    calleeCorpId: string;
    /**  参会人在所属企业中的 staff - id，注意，这里的 calleeStaffId 必须归属于上面的 calleeCorpId 对应的企业 | 必填  */
    calleeStaffId: string;
}
/**
 * 受信任的二方，可以使用该接口，向指定用户发起视频通话 返回结果定义
 * @apiName biz.conference.videoCall
 */
export interface IBizConferenceVideoCallResult {
    /** 结束原因码：200, 正常接通后挂断 201, 对方拒绝接听 202, 对方超时未接听 203, 对方正在通话中（包括语音、视频、电话和直播） 204, 主叫取消呼叫 */
    exitCode: number;
    /** 本次通话的id  */
    conferenceId: string;
    /** 被叫的所属企业id  */
    calleeCorpId: string;
    /** 被叫在其所属企业中的 staff - id */
    calleeStaffId: string;
    /** 开始呼叫的时间戳 */
    callTime: number;
    /** 被叫接听时间，如果被叫没有接听呼叫，则该值为 null  */
    acceptTime?: number;
    /** 任意一方挂断，或者主叫取消呼叫的时间戳 */
    hangupTime: number;
}
/**
 * 受信任的二方，可以使用该接口，向指定用户发起视频通话
 * @apiName biz.conference.videoCall
 * @supportVersion ios: 4.6.40 android: 4.6.40
 */
export declare function videoCall$(params: IBizConferenceVideoCallParams): Promise<IBizConferenceVideoCallResult>;
export default videoCall$;
