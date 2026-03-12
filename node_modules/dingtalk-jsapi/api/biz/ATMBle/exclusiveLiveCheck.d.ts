/**
 * 专属实人认证 请求参数定义
 * @apiName biz.ATMBle.exclusiveLiveCheck
 */
export interface IBizATMBleExclusiveLiveCheckParams {
    [key: string]: any;
}
/**
 * 专属实人认证 返回结果定义
 * @apiName biz.ATMBle.exclusiveLiveCheck
 */
export interface IBizATMBleExclusiveLiveCheckResult {
    [key: string]: any;
}
/**
 * 专属实人认证
 * @apiName biz.ATMBle.exclusiveLiveCheck
 * @supportVersion ios: 6.5.40 android: 6.5.40
 */
export declare function exclusiveLiveCheck$(params: IBizATMBleExclusiveLiveCheckParams): Promise<IBizATMBleExclusiveLiveCheckResult>;
export default exclusiveLiveCheck$;
