export declare const apiName = "biz.uic.directLogin";
/**
 * 直接免登 请求参数定义
 * @apiName biz.uic.directLogin
 */
export interface IBizUicDirectLoginParams {
    /** 企业corpId */
    corpId: string;
    /** 业务类型（天猫、新零售、xxx） */
    bizType: string;
    /** 用户id */
    userId: string;
}
/**
 * 直接免登 返回结果定义
 * @apiName biz.uic.directLogin
 */
export interface IBizUicDirectLoginResult {
    message: string;
    /**  cookie_set_success表示单账号免登成功；userlist表示多账号，会返回用户列表；error_message表示免登失败 */
    resultType: string;
}
/**
 * 直接免登
 * @apiName biz.uic.directLogin
 * @supportVersion ios: 4.5.0 android: 4.5.0
 */
export declare function directLogin$(params: IBizUicDirectLoginParams): Promise<IBizUicDirectLoginResult>;
export default directLogin$;
