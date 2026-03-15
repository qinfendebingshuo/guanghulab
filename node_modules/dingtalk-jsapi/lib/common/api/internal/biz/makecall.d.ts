export declare const apiName = "internal.biz.makecall";
/**
 * 拨打voip办公电话等 请求参数定义
 * @apiName internal.biz.makecall
 */
export interface IInternalBizMakecallParams {
    /** 调用 api 的业务标识，如天元业务:tianyuan(大小写敏感) */
    bizType: string;
    /** 1:VoIP 2:办公电话 */
    callType: string;
    /** 例如callType是1,VoIP, 这个字段可选填： voip或者pstn(大小写敏感)目前只支持voip */
    callTypeExtra: string;
    /** 被叫的所属企业id */
    corpId: string;
    /** 参会人在所属企业中的 staff-id，注意，这里的 staffId 必须归属于上面的 corpId 对应的企业 */
    staffId: string;
}
/**
 * 拨打voip办公电话等 返回结果定义
 * @apiName internal.biz.makecall
 */
export interface IInternalBizMakecallResult {
    /** 通话的callId，可以通过这个callId去查询这通通话的详细信息，比如接通状态，通话时长等 */
    callId: string;
}
/**
 * 拨打voip办公电话等
 * @apiName internal.biz.makecall
 * @supportVersion pc: 4.7.12
 * @author windows:楞伽; mac:远觉
 */
export declare function makecall$(params: IInternalBizMakecallParams): Promise<IInternalBizMakecallResult>;
export default makecall$;
