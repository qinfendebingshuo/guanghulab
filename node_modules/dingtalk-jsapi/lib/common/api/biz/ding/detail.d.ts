export declare const apiName = "biz.ding.detail";
/**
 * 智能会议室打开会议详情 请求参数定义
 * @apiName biz.ding.detail
 */
export interface IBizDingDetailParams {
    /** DING详情Id */
    dingId: string;
    /** 业务类型(0：通知DING；1：任务；2：会议) */
    bizType: number;
}
/**
 * 智能会议室打开会议详情 返回结果定义
 * @apiName biz.ding.detail
 */
export interface IBizDingDetailResult {
}
/**
 * 智能会议室打开会议详情
 * @apiName biz.ding.detail
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function detail$(params: IBizDingDetailParams): Promise<IBizDingDetailResult>;
export default detail$;
