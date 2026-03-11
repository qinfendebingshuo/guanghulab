export declare const apiName = "biz.contact.manageContactAlert";
/**
 * 管理获取通信录弹窗 请求参数定义
 * @apiName biz.contact.manageContactAlert
 */
export interface IBizContactManageContactAlertParams {
    [key: string]: any;
}
/**
 * 管理获取通信录弹窗 返回结果定义
 * @apiName biz.contact.manageContactAlert
 */
export interface IBizContactManageContactAlertResult {
    [key: string]: any;
}
/**
 * 管理获取通信录弹窗
 * @apiName biz.contact.manageContactAlert
 * @supportVersion  ios: 3.4 android: 3.4
 */
export declare function manageContactAlert$(params: IBizContactManageContactAlertParams): Promise<IBizContactManageContactAlertResult>;
export default manageContactAlert$;
