export declare const apiName = "biz.contact.pickJobTitle";
/**
 * 选择职务 请求参数定义
 * @apiName biz.contact.pickJobTitle
 */
export interface IBizContactPickJobTitleParams {
    [key: string]: any;
}
/**
 * 选择职务 返回结果定义
 * @apiName biz.contact.pickJobTitle
 */
export interface IBizContactPickJobTitleResult {
    [key: string]: any;
}
/**
 * 选择职务
 * @apiName biz.contact.pickJobTitle
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function pickJobTitle$(params: IBizContactPickJobTitleParams): Promise<IBizContactPickJobTitleResult>;
export default pickJobTitle$;
