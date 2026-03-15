export declare const apiName = "internal.auth.identifyByContactsVerify";
/**
 * 通过从15个钉钉用户中，选出自己最近联系的2个，来做登录验证 请求参数定义
 * @apiName internal.auth.identifyByContactsVerify
 */
export interface IInternalAuthIdentifyByContactsVerifyParams {
    /** 用户手机号（带countryCode，示例：+86-1378276382） */
    mobile: string;
    /** 用户上次验证因子code */
    tmpCode: string;
    /** 用户当前所在的流程标识（入Login） */
    action: string;
    /** 识别当前手机号的是哪个用户 */
    historyId?: number;
}
/**
 * 通过从15个钉钉用户中，选出自己最近联系的2个，来做登录验证 返回结果定义
 * @apiName internal.auth.identifyByContactsVerify
 */
export interface IInternalAuthIdentifyByContactsVerifyResult {
}
/**
 * 通过从15个钉钉用户中，选出自己最近联系的2个，来做登录验证
 * @apiName internal.auth.identifyByContactsVerify
 * @supportVersion ios: 5.1.19 android: 5.1.19
 * @author iOS：姚曦 Android：几米
 */
export declare function identifyByContactsVerify$(params: IInternalAuthIdentifyByContactsVerifyParams): Promise<IInternalAuthIdentifyByContactsVerifyResult>;
export default identifyByContactsVerify$;
