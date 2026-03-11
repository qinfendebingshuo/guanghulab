export declare const apiName = "biz.contact.complexChoose";
/**
 * 企业通讯录同时选人，选部门 请求参数定义
 * @apiName biz.contact.complexChoose
 */
export interface IBizContactComplexChooseParams {
    [key: string]: any;
}
/**
 * 企业通讯录同时选人，选部门 返回结果定义
 * @apiName biz.contact.complexChoose
 */
export interface IBizContactComplexChooseResult {
    [key: string]: any;
}
/**
 * 企业通讯录同时选人，选部门
 * @apiName biz.contact.complexChoose
 * @supportVersion  ios: 2.4.0 android: 2.4.0
 */
export declare function complexChoose$(params: IBizContactComplexChooseParams): Promise<IBizContactComplexChooseResult>;
export default complexChoose$;
