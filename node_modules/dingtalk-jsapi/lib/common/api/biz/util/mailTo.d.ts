export declare const apiName = "biz.util.mailTo";
/**
 * 拉起系统邮件APP写邮件 请求参数定义
 * @apiName biz.util.mailTo
 */
export interface IBizUtilMailToParams {
    /** 邮件标题。可以为空 */
    subject?: string;
    /** 邮件内容，可以为空 */
    content?: string;
}
/**
 * 拉起系统邮件APP写邮件 返回结果定义
 * @apiName biz.util.mailTo
 */
export interface IBizUtilMailToResult {
}
/**
 * 拉起系统邮件APP写邮件
 * @apiName biz.util.mailTo
 * @supportVersion ios: 5.1.37 android: 5.1.37
 * @author Android: 步定, iOS: 照磊
 */
export declare function mailTo$(params: IBizUtilMailToParams): Promise<IBizUtilMailToResult>;
export default mailTo$;
