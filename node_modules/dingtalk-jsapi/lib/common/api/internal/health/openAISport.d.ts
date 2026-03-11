export declare const apiName = "internal.health.openAISport";
/**
 * 打开AI跳绳 请求参数定义
 * @apiName internal.health.openAISport
 */
export interface IInternalHealthOpenAISportParams {
    /** AI 运动类型 Code，跳绳：A007 */
    code: number;
    /** 来源，dingding/taobao/ledongli */
    source: string;
}
/**
 * 打开AI跳绳 返回结果定义
 * @apiName internal.health.openAISport
 */
export interface IInternalHealthOpenAISportResult {
}
/**
 * 打开AI跳绳
 * @apiName internal.health.openAISport
 * @supportVersion ios: 5.1.34 android: 5.1.34
 * @author Android：铠甲 iOS：邓颖
 */
export declare function openAISport$(params: IInternalHealthOpenAISportParams): Promise<IInternalHealthOpenAISportResult>;
export default openAISport$;
