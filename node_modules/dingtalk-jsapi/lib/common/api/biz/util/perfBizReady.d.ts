export declare const apiName = "biz.util.perfBizReady";
/**
 * 新增业务性能埋点接口 请求参数定义
 * @apiName biz.util.perfBizReady
 */
export interface IBizUtilPerfBizReadyParams {
    availableTime?: number;
}
/**
 * 新增业务性能埋点接口 返回结果定义
 * @apiName biz.util.perfBizReady
 */
export interface IBizUtilPerfBizReadyResult {
    [key: string]: any;
}
/**
 * 新增业务性能埋点接口
 * @description 用于业务性能埋点 perfBizReady的时长会上传到小程序基础性能埋点. (https://dp2.motu.alibaba-inc.com/#/event/60433/base?appId=23010479%40iphoneos) 对应的埋点字段统一为: bizReadyCost
 * @apiName biz.util.perfBizReady
 * @supportVersion ios: 5.1.8 android: 5.1.8
 * @author iOS：贾逵 Android：落韵
 */
export declare function perfBizReady$(params: IBizUtilPerfBizReadyParams): Promise<IBizUtilPerfBizReadyResult>;
export default perfBizReady$;
