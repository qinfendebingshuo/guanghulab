export declare const apiName = "biz.uic.doLogin";
/**
 * uic获取免登数据 请求参数定义
 * @apiName biz.uic.doLogin
 */
export interface IBizUicDoLoginParams {
    /** 企业corpId */
    corpId: string;
    /**  业务类型（天猫、新零售、xxx） */
    bizType: string;
}
/**
 * uic获取免登数据 返回结果定义
 * @apiName biz.uic.doLogin
 */
export interface IBizUicDoLoginResult {
    message: string;
    /**  cookie_set_success表示单账号免登成功；userlist表示多账号，会返回用户列表；error_message表示免登失败 */
    resultType: string;
    /**  根据resultType解析对应数据 */
    data?: string;
}
/**
 * uic获取免登数据
 * @apiName biz.uic.doLogin
 * @supportVersion ios: 4.5.0 android: 4.5.0
 */
export declare function doLogin$(params: IBizUicDoLoginParams): Promise<IBizUicDoLoginResult>;
export default doLogin$;
