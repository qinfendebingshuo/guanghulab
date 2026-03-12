export declare const apiName = "biz.util.createVoipConference";
/**
 * 创建voip会议 请求参数定义
 * @apiName biz.util.createVoipConference
 */
export interface IBizUtilCreateVoipConferenceParams {
    [key: string]: any;
}
/**
 * 创建voip会议 返回结果定义
 * @apiName biz.util.createVoipConference
 */
export interface IBizUtilCreateVoipConferenceResult {
    [key: string]: any;
}
/**
 * 创建voip会议
 * @apiName biz.util.createVoipConference
 * @supportVersion  pc: 3.0.0
 */
export declare function createVoipConference$(params: IBizUtilCreateVoipConferenceParams): Promise<IBizUtilCreateVoipConferenceResult>;
export default createVoipConference$;
