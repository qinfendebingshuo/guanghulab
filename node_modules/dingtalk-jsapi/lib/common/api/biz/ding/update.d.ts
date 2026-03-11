export declare const apiName = "biz.ding.update";
/**
 * 打开DING修改窗口 请求参数定义
 * @apiName biz.ding.update
 */
export interface IBizDingUpdateParams {
    /** DING id，必选 */
    dingId: string;
    /** 业务类型，必选【0：通知DING；1：任务；2：会议；】  */
    bizType: number;
    /** 会议重复，必选【 0：非重复，1：重复所有，2：重复单次】 */
    meetingScope: number;
}
/**
 * 打开DING修改窗口 返回结果定义
 * @apiName biz.ding.update
 */
export interface IBizDingUpdateResult {
    [key: string]: any;
}
/**
 * 打开DING修改窗口
 * @apiName biz.ding.update
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function update$(params: IBizDingUpdateParams): Promise<IBizDingUpdateResult>;
export default update$;
