export declare const apiName = "biz.contact.addFromManual";
/**
 * 选企业通信录的人 请求参数定义
 * @apiName biz.contact.addFromManual
 */
export interface IBizContactAddFromManualParams {
    [key: string]: any;
}
/**
 * 选企业通信录的人 返回结果定义
 * @apiName biz.contact.addFromManual
 */
export interface IBizContactAddFromManualResult {
    [key: string]: any;
}
/**
 * 选企业通信录的人
 * @apiName biz.contact.addFromManual
 * @supportVersion  ios: 3.0 android: 3.0
 */
export declare function addFromManual$(params: IBizContactAddFromManualParams): Promise<IBizContactAddFromManualResult>;
export default addFromManual$;
