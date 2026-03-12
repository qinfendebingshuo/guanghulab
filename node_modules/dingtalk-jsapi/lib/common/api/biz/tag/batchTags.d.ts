export declare const apiName = "biz.tag.batchTags";
/**
 * 批量获取全局标签信息 请求参数定义
 * @apiName biz.tag.batchTags
 */
export interface IBizTagBatchTagsParams {
    tagCodes: string[];
}
/**
 * 批量获取全局标签信息 返回结果定义
 * @apiName biz.tag.batchTags
 */
export interface IBizTagBatchTagsResult {
    [tagCode: string]: {
        valid: boolean;
        name: string;
    };
}
/**
 * 批量获取全局标签信息
 * @apiName biz.tag.batchTags
 * @supportVersion pc: 5.1.40
 * @author PC：心存
 */
export declare function batchTags$(params: IBizTagBatchTagsParams): Promise<IBizTagBatchTagsResult>;
export default batchTags$;
